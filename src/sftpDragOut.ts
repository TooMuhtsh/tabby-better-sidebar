import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { NgZone } from '@angular/core'
import { NotificationsService } from 'tabby-core'
import { SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { electronRemote } from './electronRemote'
import { LocalFileDownload } from './sftpLocalTransfer'

/** The live SFTP transport, borrowed from the one member that publicly exposes its type. */
type SftpSession = SFTPPanelComponent['sftp']

/** What a directory holds, as far as the guard rail below needs to know. */
export interface DirectoryWeight {
    files: number
    bytes: number
    /** True when counting stopped at the threshold instead of reaching the end — the totals are lower bounds. */
    truncated: boolean
}

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
    /** Remote path → local copy, for entries already downloaded. */
    private ready = new Map<string, string>()
    /** Remote paths being downloaded right now — a second drag must not start a second download. */
    private preparing = new Set<string>()
    private root: string|null = null
    private counter = 0

    constructor (
        private notifications: NotificationsService,
        private zone: NgZone,
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
     * Starts the native drag for an entry already downloaded.
     *
     * Returns false when there is nothing to drag yet, or when the remote
     * module is unreachable — the caller then falls back to preparing it.
     */
    startDrag (remotePath: string): boolean {
        const localPath = this.ready.get(remotePath)
        if (!localPath) {
            return false
        }
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
        if (this.ready.has(item.fullPath) || this.preparing.has(item.fullPath)) {
            return
        }
        this.setPreparing(item.fullPath, true)
        try {
            const localDir = await this.newTempDir()
            const localPath = path.join(localDir, item.name)
            if (isDirectory) {
                await this.downloadDirectory(sftp, item.fullPath, localPath)
            } else {
                await this.downloadFile(sftp, item.fullPath, localPath, item)
            }
            this.ready.set(item.fullPath, localPath)
            this.startDrag(item.fullPath)
        } catch (e) {
            this.notifications.error(`Impossible de préparer ${item.name} pour le glisser-déposer`, String(e))
        } finally {
            this.setPreparing(item.fullPath, false)
        }
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
        const root = this.root
        this.ready.clear()
        this.preparing.clear()
        this.root = null
        if (root) {
            void fs.promises.rm(root, { recursive: true, force: true }).catch(() => null)
        }
    }

    private async newTempDir (): Promise<string> {
        this.root ??= path.join(os.tmpdir(), 'tabby-better-sidebar-drag', `${Date.now()}`)
        const dir = path.join(this.root, String(this.counter++))
        await fs.promises.mkdir(dir, { recursive: true })
        return dir
    }

    private async downloadFile (sftp: SftpSession, remotePath: string, localPath: string, item: SFTPFile): Promise<void> {
        const download = new LocalFileDownload(localPath, item.name, item.size, item.mode)
        await download.openForWriting()
        await sftp.download(remotePath, download)
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
        await fs.promises.mkdir(localPath, { recursive: true })
        for (const entry of await sftp.readdir(remotePath)) {
            const childLocal = path.join(localPath, entry.name)
            if (entry.isDirectory) {
                await this.downloadDirectory(sftp, entry.fullPath, childLocal)
                continue
            }
            if (entry.isSymlink && await this.targetIsDirectory(sftp, entry.fullPath)) {
                continue
            }
            await this.downloadFile(sftp, entry.fullPath, childLocal, entry)
        }
    }

    /** A failed `stat()` counts as "directory": the entry is skipped rather than risking the whole copy on it. */
    private async targetIsDirectory (sftp: SftpSession, remotePath: string): Promise<boolean> {
        try {
            const stat = await sftp.stat(remotePath)
            return stat.isDirectory || (stat.mode & 0o170000) === 0o040000
        } catch {
            return true
        }
    }
}
