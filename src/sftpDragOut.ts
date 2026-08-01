import * as fs from 'fs'
import * as path from 'path'
import { NgZone } from '@angular/core'
import { SidebarPlusNoticesService } from './notices.service'
import { SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { electronRemote } from './electronRemote'
import { readRemoteEntry } from './remoteEntry'
import { SidebarPlusTempFilesService } from './tempFiles.service'
import { SftpTransfers } from './transfers'

/** The live SFTP transport, borrowed from the one member that publicly exposes its type. */
type SftpSession = SFTPPanelComponent['sftp']

/**
 * A local copy, and what the remote entry looked like when it was taken.
 *
 * Size and mtime are what tells a still-current copy from a stale one. A
 * *directory* carries neither in any useful form — its own mtime says nothing
 * about what changed inside it — so a directory copy is reused as-is and
 * `isDirectory` marks it as unverifiable rather than pretending otherwise.
 */
interface ReadyCopy {
    localPath: string
    size: number
    mtime: number
    isDirectory: boolean
}

/** What a directory holds, as far as the guard rail below needs to know. */
export interface DirectoryWeight {
    files: number
    bytes: number
    /** True when counting stopped at the threshold instead of reaching the end — the totals are lower bounds. */
    truncated: boolean
}

/** How many files of a directory are fetched at once. See `downloadAll()`. */
const DOWNLOAD_CONCURRENCY = 4

/**
 * A 32×32 sheet-of-paper PNG, inlined as a data URL.
 *
 * `startDrag()` demands a NativeImage and `nativeImage.createEmpty()` throws on
 * Windows, so an icon is not optional. Inlined rather than shipped as an asset:
 * the plugin bundles to a single file and a `file://` path would have to be
 * resolved at runtime from inside a webpack bundle.
 */
const DRAG_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAASUlEQVR4nO3SMQoAIAwEwfz/kRZ2vkJbEe1kI7IHKe+YIhHm1ZTa+s0TgAFOXRSw6+OAdSMFMO9ggPQnFCBAgAABAgQI+AdgqAwQ3EkaXaJWzQAAAABJRU5ErkJggg=='

/**
 * Dragging a remote entry out of the panel and into the OS.
 *
 * `webContents.startDrag()` — the only API for this, Tabby has none of its own
 * — needs a file that already exists locally, so every drag is really "download
 * to a temp dir, then start a native drag on the copy". Two consequences shape
 * everything here:
 *
 *   - The download cannot happen inside the `dragstart` handler, which is
 *     synchronous. The first drag of an entry therefore *prepares* it and
 *     usually ends without dragging anything; the copy is kept, so the next
 *     drag starts instantly. `startDrag()` is still attempted as soon as the
 *     download lands, which makes the single-gesture case work whenever the
 *     file is small enough and the button is still held.
 *   - Copies are removed on `dispose()`, never on `dragend`: Windows reads the
 *     file when the drop lands, which can be after the drag has ended.
 *
 * Deliberately *not* built on `SftpRemoteEditor`: that one installs an
 * `fs.watch` and re-uploads on every local change. A copy dragged to the
 * desktop and edited there would silently overwrite the server's file.
 */
export class SftpDragOut {
    /** Remote path → the copy taken for it, with the fingerprint it was taken from. */
    private ready = new Map<string, ReadyCopy>()
    /** Remote paths being downloaded right now — a second drag must not start a second download. */
    private preparing = new Set<string>()
    /** Every directory handed out for this panel, so `dispose()` can drop them all. */
    private dirs = new Set<string>()

    constructor (
        private notifications: SidebarPlusNoticesService,
        private zone: NgZone,
        private transfers: SftpTransfers,
        private temp: SidebarPlusTempFilesService,
    ) { }

    /**
     * Every mutation of `preparing` goes through the Angular zone.
     *
     * The flag drives the row's only visible state, and it is flipped on both
     * sides of `await sftp.download(...)` — russh's promises are native
     * bindings zone.js never patched, so the resumption runs outside the zone
     * and the class would be set on an object nothing repaints (piège #41).
     * With the gesture already over by then, that state is all the user has to
     * know the drag is being prepared.
     */
    private setPreparing (remotePath: string, value: boolean): void {
        this.zone.run(() => {
            if (value) {
                this.preparing.add(remotePath)
            } else {
                this.preparing.delete(remotePath)
            }
        })
    }

    /** True while an entry is downloading — drives the row's "préparation" state. */
    isPreparing (remotePath: string): boolean {
        return this.preparing.has(remotePath)
    }

    isReady (remotePath: string): boolean {
        return this.ready.has(remotePath)
    }

    /**
     * Whether the copy taken for an entry no longer matches it.
     *
     * Compares against the row as displayed, which costs nothing — the
     * authoritative check is the `stat()` in `prepare()`, this one only avoids
     * handing over a copy already known to be out of date.
     */
    private isStale (copy: ReadyCopy, item: SFTPFile): boolean {
        if (copy.isDirectory) {
            return false
        }
        return copy.size !== item.size || copy.mtime !== item.modified.getTime()
    }

    /**
     * Starts the native drag for an entry already downloaded and still current.
     *
     * Returns false when there is nothing to drag yet, when the copy is stale,
     * or when the remote module is unreachable — the caller then falls back to
     * preparing it.
     */
    startDrag (item: SFTPFile): boolean {
        const copy = this.ready.get(item.fullPath)
        if (!copy || this.isStale(copy, item)) {
            return false
        }
        const localPath = copy.localPath
        const remote = electronRemote()
        if (!remote) {
            this.notifications.error('Le glisser-déposer sortant n\'est pas disponible sur cette installation')
            return false
        }
        try {
            remote.getCurrentWindow().webContents.startDrag({
                file: localPath,
                icon: remote.nativeImage.createFromDataURL(DRAG_ICON_DATA_URL),
            })
            return true
        } catch (e) {
            this.notifications.error('Impossible de démarrer le glisser-déposer', String(e))
            return false
        }
    }

    /**
     * Downloads an entry to the temp directory, then tries to start the drag
     * straight away — worth attempting because a small file lands while the
     * button is often still held, which turns the whole thing into one gesture.
     */
    async prepare (sftp: SftpSession, item: SFTPFile, isDirectory: boolean): Promise<void> {
        if (this.preparing.has(item.fullPath)) {
            return
        }
        this.setPreparing(item.fullPath, true)
        try {
            // The server's answer, not the row's — the listing is a snapshot
            // taken when the directory was last read, and a file changed on the
            // server since then looks unchanged in it. This is the check that
            // stops a stale copy from being handed over.
            const fresh = await this.remoteFingerprint(sftp, item)
            const existing = this.ready.get(item.fullPath)
            if (existing && !this.isStale(existing, fresh)) {
                this.startDrag(fresh)
                return
            }
            this.ready.delete(item.fullPath)

            const localDir = await this.temp.makeDir('drag')
            this.dirs.add(localDir)
            const localPath = path.join(localDir, item.name)
            if (isDirectory) {
                await this.downloadDirectory(sftp, item.fullPath, localPath)
            } else {
                await this.downloadFile(sftp, item.fullPath, localPath, item)
            }
            this.ready.set(item.fullPath, {
                localPath,
                size: fresh.size,
                mtime: fresh.modified.getTime(),
                isDirectory,
            })
            this.startDrag(fresh)
        } catch (e) {
            this.notifications.error(`Impossible de préparer ${item.name} pour le glisser-déposer`, String(e))
        } finally {
            this.setPreparing(item.fullPath, false)
        }
    }

    /**
     * Checks a copy that has just been handed over, and says so if it was stale.
     *
     * `dragstart` is synchronous: asking the server before starting the drag is
     * impossible, so a copy that still looks current in the listing is used as
     * is. This runs right after and closes the gap — the entry is dropped so the
     * next gesture downloads afresh, and the user is *told*, because silently
     * handing over yesterday's file is precisely the failure this chantier
     * exists to fix.
     */
    async revalidate (sftp: SftpSession, item: SFTPFile): Promise<void> {
        const copy = this.ready.get(item.fullPath)
        if (!copy || copy.isDirectory) {
            return
        }
        const fresh = await this.remoteFingerprint(sftp, item)
        if (this.isStale(copy, fresh)) {
            this.ready.delete(item.fullPath)
            this.notifications.notice(`${item.name} a changé sur le serveur — reglissez-le pour obtenir la version à jour`)
        }
    }

    /**
     * The entry as the server sees it *now*.
     *
     * Falls back to the displayed row if the `stat()` fails: a copy that cannot
     * be checked is better handed over than a gesture that fails outright, and
     * the download that follows would fail on its own if the entry were really
     * gone.
     */
    private async remoteFingerprint (sftp: SftpSession, item: SFTPFile): Promise<SFTPFile> {
        return await readRemoteEntry(sftp, item.fullPath) ?? item
    }

    /**
     * Counts what a directory holds, stopping as soon as either threshold is
     * passed.
     *
     * The early exit is the point: the guard rail only needs to know whether the
     * directory is *big*, and walking a genuinely huge tree to the end just to
     * decide whether to ask a question would cost as much as the download it is
     * meant to guard.
     */
    async weigh (sftp: SftpSession, remotePath: string, maxFiles: number, maxBytes: number): Promise<DirectoryWeight> {
        const weight: DirectoryWeight = { files: 0, bytes: 0, truncated: false }
        const walk = async (p: string): Promise<void> => {
            if (weight.truncated) {
                return
            }
            const entries = await sftp.readdir(p)
            for (const entry of entries) {
                if (weight.truncated) {
                    return
                }
                if (entry.isDirectory) {
                    await walk(entry.fullPath)
                    continue
                }
                weight.files++
                weight.bytes += entry.size
                if (weight.files > maxFiles || weight.bytes > maxBytes) {
                    weight.truncated = true
                    return
                }
            }
        }
        await walk(remotePath)
        return weight
    }

    /** Called when the browser is torn down — removes every copy made for a drag. */
    dispose (): void {
        this.ready.clear()
        this.preparing.clear()
        for (const dir of this.dirs) {
            void this.temp.remove(dir)
        }
        this.dirs.clear()
    }

    private async downloadFile (sftp: SftpSession, remotePath: string, localPath: string, item: SFTPFile): Promise<void> {
        await this.transfers.download(sftp, remotePath, localPath, item.name, item.size, item.mode)
    }

    /**
     * Depth-first copy of a remote directory.
     *
     * A symlink to a *directory* is skipped, not followed: following it invites
     * a cycle (a link back to any ancestor would recurse forever), and there is
     * no realpath in `SFTPSession` to detect one with. A symlink to a file is
     * downloaded normally — the server resolves it, so the copy is the target's
     * content.
     *
     * Skipping is not cosmetic. Downloading a link-to-directory as a file makes
     * the server answer `Failure` (EISDIR), which would throw and fail the whole
     * directory: one link would make a perfectly ordinary tree undraggable. And
     * the entry's own flags cannot tell the two apart — `isDirectory` is false
     * for any symlink, and its `mode` describes the link. Only a `stat()` of the
     * target answers, and only through the mode (piège #45).
     */
    private async downloadDirectory (sftp: SftpSession, remotePath: string, localPath: string): Promise<void> {
        const files: { remote: string, local: string, item: SFTPFile }[] = []

        const walk = async (remote: string, local: string): Promise<void> => {
            await fs.promises.mkdir(local, { recursive: true })
            for (const entry of await sftp.readdir(remote)) {
                const childLocal = path.join(local, entry.name)
                if (entry.isDirectory) {
                    await walk(entry.fullPath, childLocal)
                    continue
                }
                if (entry.isSymlink && await this.targetIsDirectory(sftp, entry.fullPath)) {
                    continue
                }
                files.push({ remote: entry.fullPath, local: childLocal, item: entry })
            }
        }

        // The whole tree is walked before anything is fetched: the directories
        // have to exist before their files land, and knowing the full list is
        // what allows the transfers to overlap at all.
        await walk(remotePath, localPath)
        await this.downloadAll(files.map(f => () => this.downloadFile(sftp, f.remote, f.local, f.item)))
    }

    /**
     * Runs the transfers a few at a time.
     *
     * Measured on 26 files totalling 11 MB: over a minute, while the same
     * directory through Tabby's own download is near-instant, and a single
     * 10 MB file through this very code path is too. So the cost is per *file*,
     * not per byte — round trips to open, read and close each one, which
     * overlap perfectly well. Strictly sequential, they simply queued.
     *
     * Bounded rather than unbounded: every transfer shares one SFTP channel,
     * and a hundred concurrent opens would trade one queue for another while
     * making a failure much harder to attribute.
     */
    private async downloadAll (tasks: (() => Promise<void>)[]): Promise<void> {
        let next = 0
        const workers = Array.from(
            { length: Math.min(DOWNLOAD_CONCURRENCY, tasks.length) },
            async () => {
                while (next < tasks.length) {
                    await tasks[next++]()
                }
            },
        )
        await Promise.all(workers)
    }

    /**
     * Whether a symlink points at a directory. A failure counts as "yes": the
     * entry is skipped rather than risking the whole copy on it.
     *
     * Resolved through the link and read from the *listing*, not from `stat()`
     * — whose mode is always 0 here, which left the mode test of piège #45
     * permanently false and the guard rail resting on `isDirectory` alone.
     */
    private async targetIsDirectory (sftp: SftpSession, remotePath: string): Promise<boolean> {
        try {
            const target = await sftp.readlink(remotePath)
            const entry = await readRemoteEntry(sftp, path.posix.resolve(path.posix.dirname(remotePath), target))
            if (!entry) {
                return true
            }
            return entry.isDirectory || (entry.mode & 0o170000) === 0o040000
        } catch {
            return true
        }
    }
}
