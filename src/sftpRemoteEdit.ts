import * as fs from 'fs'
import * as path from 'path'
import { SidebarPlusNoticesService } from './notices.service'
import { SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { Opener, SidebarPlusEditorService } from './editorLauncher.service'
import { readRemoteEntry } from './remoteEntry'
import { SidebarPlusTempFilesService } from './tempFiles.service'
import { SftpTransfers } from './transfers'

/**
 * How the local copy is handed over once downloaded.
 *
 * `editor` is the only thing a double-click can reach; `openWith` is the
 * explicit context-menu escape hatch (Windows' own "Open with..." dialog).
 */
export type OpenMode = 'editor'|'openWith'

/** The live SFTP transport, borrowed from the one member that publicly exposes its type. */
type SftpSession = SFTPPanelComponent['sftp']

/** What the remote file looked like at a given moment, as far as change detection needs. */
interface RemoteStamp {
    size: number
    mtime: number
    /**
     * The permissions as they stood at that instant.
     *
     * Read here rather than taken from the listing: the row carries the mode as
     * of the last directory read, which can predate a `chmod` made in a
     * terminal since. Restoring *that* after an upload does not preserve the
     * file's permissions, it silently reverts them.
     */
    mode: number
}

/** Asks the user a yes/no question. Supplied by the panel, which owns the HTML modal (piège #42). */
export type ConfirmFn = (message: string, confirmLabel: string) => Promise<boolean>

interface EditSession {
    localPath: string
    localDir: string
    watcher: fs.FSWatcher
    /** Size and mtime as of the last transfer in either direction — anything else means the editor saved. */
    baseline: { size: number, mtimeMs: number }
    /** The remote entry as it stood after that same transfer — anything else means someone else wrote to it. */
    remote: RemoteStamp
    uploading: boolean
    /** A save that landed while an upload was in flight, replayed once it finishes. */
    pending: boolean
    debounce: ReturnType<typeof setTimeout>|null
}

/**
 * Opens a remote file in the configured editor, and sends it back on every
 * save.
 *
 * The file is copied to a private temp directory, handed to the editor, and
 * watched; each save re-uploads it. Nothing is ever silent — every upload
 * raises a notification, because this writes to a live server.
 *
 * Never `shell.openPath()`, which is what this used to do: opening by OS
 * association *runs* an executable, or a script whose extension is bound to an
 * interpreter, instead of editing it. The editor is spawned explicitly, and the
 * only route to the OS association is the caller passing `openWith` — the
 * context menu's deliberate escape hatch, unreachable by double-click.
 *
 * Changes made *on the server* while a file is open are detected, not ignored.
 * Two moments matter, and neither is decided without asking:
 *
 *   - **Reopening** an already-open file used to hand back the local copy
 *     unconditionally, so a file edited on the server came back as the old
 *     version. It is now compared against the server first.
 *   - **Saving** used to overwrite whatever had appeared in the meantime, with
 *     no warning at all — the failure mode that actually loses someone's work.
 */
export class SftpRemoteEditor {
    private sessions = new Map<string, EditSession>()
    /** Sends still in flight — see `track()`. */
    private uploads = new Set<Promise<void>>()

    constructor (
        private notifications: SidebarPlusNoticesService,
        private editors: SidebarPlusEditorService,
        private transfers: SftpTransfers,
        private temp: SidebarPlusTempFilesService,
        private confirm: ConfirmFn,
    ) { }

    /** Hands a local copy over. The opener is settled by `edit()` before anything is downloaded. */
    private open (localPath: string, opener: Opener): void {
        if (opener.kind === 'openWith') {
            this.editors.openWith(localPath, opener.learn)
            return
        }
        this.editors.launchEditor(opener.path, localPath)
    }

    /**
     * Watching the *directory* rather than the file: many editors save by
     * writing a new file and renaming it over the old one, which severs a
     * watch held on the original inode and would make the second save onwards
     * go unnoticed.
     */
    async edit (sftp: SftpSession, item: SFTPFile, mode: OpenMode = 'editor'): Promise<void> {
        // Settled first, and deliberately before the temp dir and the
        // download: on a platform with no "open with" dialog this raises a file
        // picker that can be cancelled, and bailing out later would leave a
        // downloaded copy, a live fs.watch and a registered session for a file
        // nobody ever opened.
        const opener: Opener|null = mode === 'openWith'
            ? { kind: 'openWith' }
            : await this.editors.resolveOpener()
        if (!opener) {
            return
        }

        const existing = this.sessions.get(item.fullPath)
        if (existing) {
            await this.reopen(sftp, item, existing, opener)
            return
        }

        const localDir = await this.temp.makeDir('edit')
        const localPath = path.join(localDir, item.name)

        try {
            await this.transfers.download(sftp, item.fullPath, localPath, item.name, item.size, item.mode)
        } catch (e) {
            await this.temp.remove(localDir)
            // The full path, not just the name: a `Failure` status here is
            // usually the server refusing to open something that is not a
            // regular file (EISDIR is reported as a plain FAILURE), and knowing
            // *which* path was asked for is what tells the two apart.
            this.notifications.error(`Impossible de télécharger ${item.fullPath}`, String(e))
            return
        }

        const stat = await fs.promises.stat(localPath)
        const session: EditSession = {
            localPath,
            localDir,
            baseline: { size: stat.size, mtimeMs: stat.mtimeMs },
            remote: await this.remoteStamp(sftp, item),
            uploading: false,
            pending: false,
            debounce: null,
            watcher: fs.watch(localDir, (_event, filename) => {
                if (filename !== null && path.basename(String(filename)) !== item.name) {
                    return
                }
                this.scheduleUpload(sftp, item)
            }),
        }
        this.sessions.set(item.fullPath, session)

        this.open(localPath, opener)
        this.notifications.notice(`${item.name} ouvert — chaque enregistrement sera renvoyé au serveur`)
    }

    /**
     * Reopening a file already open here.
     *
     * The old behaviour — hand the local copy straight back — exists for a
     * reason: a second download would wipe unsaved work. It is kept, but only
     * once the server has been asked. When the remote file has moved on, an
     * untouched copy is refreshed silently, and a copy with unsaved changes
     * never is without a decision: no automatic answer can be right when both
     * sides changed.
     */
    private async reopen (sftp: SftpSession, item: SFTPFile, session: EditSession, opener: Opener): Promise<void> {
        const now = await this.remoteStamp(sftp, item)
        if (!this.changed(session.remote, now)) {
            this.open(session.localPath, opener)
            return
        }

        if (await this.hasLocalEdits(session) && !await this.confirm(
            `${item.name} a changé sur le serveur, et votre copie locale a des modifications non enregistrées. `
            + 'Reprendre la version du serveur fera perdre ces modifications locales.',
            'Reprendre celle du serveur',
        )) {
            this.open(session.localPath, opener)
            return
        }

        try {
            await this.transfers.download(sftp, item.fullPath, session.localPath, item.name, item.size, item.mode)
        } catch (e) {
            // The stale copy is still better than nothing — the user asked to
            // open a file, and refusing outright over a failed refresh would
            // lose them the gesture as well as the update.
            this.notifications.error(`Impossible d'actualiser ${item.name} depuis le serveur`, String(e))
            this.open(session.localPath, opener)
            return
        }

        const stat = await fs.promises.stat(session.localPath)
        session.baseline = { size: stat.size, mtimeMs: stat.mtimeMs }
        session.remote = now
        this.notifications.notice(`${item.name} a été actualisé depuis le serveur`)
        this.open(session.localPath, opener)
    }

    /** The remote entry as the server reports it now; falls back to the listing's own view. */
    private async remoteStamp (sftp: SftpSession, item: SFTPFile): Promise<RemoteStamp> {
        const fresh = await readRemoteEntry(sftp, item.fullPath) ?? item
        return { size: fresh.size, mtime: fresh.modified.getTime(), mode: fresh.mode }
    }

    private changed (before: RemoteStamp, after: RemoteStamp): boolean {
        return before.size !== after.size || before.mtime !== after.mtime
    }

    /** Whether the editor wrote to the copy since the last transfer in either direction. */
    private async hasLocalEdits (session: EditSession): Promise<boolean> {
        const stat = await fs.promises.stat(session.localPath).catch(() => null)
        if (!stat) {
            return false
        }
        return stat.size !== session.baseline.size || stat.mtimeMs !== session.baseline.mtimeMs
    }

    /**
     * Editors emit several filesystem events per save (truncate, write,
     * rename, mtime touch), so the upload is deferred until they stop coming.
     */
    private scheduleUpload (sftp: SftpSession, item: SFTPFile): void {
        const session = this.sessions.get(item.fullPath)
        if (!session) {
            return
        }
        if (session.debounce) {
            clearTimeout(session.debounce)
        }
        session.debounce = setTimeout(() => {
            session.debounce = null
            this.track(this.uploadIfChanged(sftp, item))
        }, 400)
    }

    /**
     * Keeps a handle on a send in flight, so `dispose()` can wait for it.
     *
     * `session.uploading` already says one is running, but a flag cannot be
     * awaited, and the temp directory must not be deleted from under a file
     * still being read out of it.
     */
    private track (run: Promise<void>): void {
        this.uploads.add(run)
        void run.finally(() => this.uploads.delete(run))
    }

    private async uploadIfChanged (sftp: SftpSession, item: SFTPFile): Promise<void> {
        const session = this.sessions.get(item.fullPath)
        if (!session) {
            return
        }
        if (session.uploading) {
            // Don't interleave two writes to the same remote path; replay once
            // the in-flight one lands.
            session.pending = true
            return
        }

        let stat: fs.Stats
        try {
            stat = await fs.promises.stat(session.localPath)
        } catch {
            // Gone mid-save (some editors unlink before renaming) — the rename
            // will fire its own event.
            return
        }
        if (stat.size === session.baseline.size && stat.mtimeMs === session.baseline.mtimeMs) {
            return
        }

        // Set before the question, not after: the flag is what stops a second
        // save from opening a second modal for the same file while this one
        // waits for an answer.
        session.uploading = true
        try {
            const now = await this.remoteStamp(sftp, item)
            if (this.changed(session.remote, now) && !await this.confirm(
                `${item.name} a changé sur le serveur depuis son ouverture. Enregistrer écrasera ces modifications distantes. Continuer ?`,
                'Écraser',
            )) {
                // `session.remote` is deliberately left as it was: the conflict
                // has not been resolved, so the next save must ask again rather
                // than treat silence as consent.
                this.notifications.notice(`${item.name} n'a pas été renvoyé — le fichier distant est intact`)
                return
            }
            // `now.mode`, not `item.mode`: the mode the file has at the instant
            // it is about to be overwritten, which is the only one worth
            // putting back.
            await this.transfers.upload(sftp, item.fullPath, session.localPath, item.name, stat.size, now.mode)
            session.baseline = { size: stat.size, mtimeMs: stat.mtimeMs }
            session.remote = await this.remoteStamp(sftp, item)
            this.notifications.notice(`${item.name} renvoyé sur le serveur`)
        } catch (e) {
            this.notifications.error(`Échec du renvoi de ${item.name}`, String(e))
        } finally {
            session.uploading = false
        }

        if (session.pending) {
            session.pending = false
            this.scheduleUpload(sftp, item)
        }
    }

    /**
     * Called when the browser is torn down — stops watching and removes the
     * temp copies.
     *
     * Watching stops at once: a save made after the panel is gone has nowhere
     * to be sent. The copies, on the other hand, wait for any send still in
     * flight — deleting the directory a file is being read out of is how a
     * save silently fails to reach the server, and it would happen precisely
     * when a connection drop tears the panel down mid-save.
     */
    dispose (): void {
        const dirs: string[] = []
        for (const session of this.sessions.values()) {
            if (session.debounce) {
                clearTimeout(session.debounce)
            }
            session.watcher.close()
            dirs.push(session.localDir)
        }
        this.sessions.clear()
        const inFlight = [...this.uploads]
        this.uploads.clear()
        void Promise.allSettled(inFlight).then(() => {
            for (const dir of dirs) {
                void this.temp.remove(dir)
            }
        })
    }
}
