import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { NotificationsService } from 'tabby-core'
import { SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { Opener, SidebarPlusEditorService } from './editorLauncher.service'
import { LocalFileDownload, LocalFileUpload } from './sftpLocalTransfer'

/**
 * How the local copy is handed over once downloaded.
 *
 * `editor` is the only thing a double-click can reach; `openWith` is the
 * explicit context-menu escape hatch (Windows' own "Open with..." dialog).
 */
export type OpenMode = 'editor'|'openWith'

/** The live SFTP transport, borrowed from the one member that publicly exposes its type. */
type SftpSession = SFTPPanelComponent['sftp']

interface EditSession {
    localPath: string
    localDir: string
    watcher: fs.FSWatcher
    /** Size and mtime as of the last transfer in either direction — anything else means the editor saved. */
    baseline: { size: number, mtimeMs: number }
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
 * Not implemented, and worth knowing before relying on this: there is no
 * conflict detection. If the remote file changes between the download and a
 * save, the save overwrites it.
 */
export class SftpRemoteEditor {
    private sessions = new Map<string, EditSession>()
    private counter = 0

    constructor (
        private notifications: NotificationsService,
        private editors: SidebarPlusEditorService,
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
            // Already open somewhere — just bring it back to the front rather
            // than downloading a second copy over the user's unsaved work.
            this.open(existing.localPath, opener)
            return
        }

        const localDir = path.join(os.tmpdir(), 'tabby-better-sidebar-edit', `${Date.now()}-${this.counter++}`)
        await fs.promises.mkdir(localDir, { recursive: true })
        const localPath = path.join(localDir, item.name)

        const download = new LocalFileDownload(localPath, item.name, item.size, item.mode)
        await download.openForWriting()
        try {
            await sftp.download(item.fullPath, download)
        } catch (e) {
            await fs.promises.rm(localDir, { recursive: true, force: true }).catch(() => null)
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
            void this.uploadIfChanged(sftp, item)
        }, 400)
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

        session.uploading = true
        const upload = new LocalFileUpload(session.localPath, item.name, stat.size, item.mode)
        try {
            await upload.openForReading()
            await sftp.upload(item.fullPath, upload)
            session.baseline = { size: stat.size, mtimeMs: stat.mtimeMs }
            this.notifications.notice(`${item.name} renvoyé sur le serveur`)
        } catch (e) {
            this.notifications.error(`Échec du renvoi de ${item.name}`, String(e))
        } finally {
            upload.close()
            session.uploading = false
        }

        if (session.pending) {
            session.pending = false
            this.scheduleUpload(sftp, item)
        }
    }

    /** Called when the browser is torn down — stops watching and removes the temp copies. */
    dispose (): void {
        for (const session of this.sessions.values()) {
            if (session.debounce) {
                clearTimeout(session.debounce)
            }
            session.watcher.close()
            void fs.promises.rm(session.localDir, { recursive: true, force: true }).catch(() => null)
        }
        this.sessions.clear()
    }
}
