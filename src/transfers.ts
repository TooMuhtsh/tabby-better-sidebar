import * as fs from 'fs'
import { FileDownload, FileTransfer, FileUpload, PlatformService } from 'tabby-core'
import { SidebarPlusNoticesService } from './notices.service'
import { SidebarPlusTransfersService, TransferContext } from './transfersRegistry.service'
import { SFTPPanelComponent } from 'tabby-ssh'
import { LocalFileDownload, LocalFileUpload } from './sftpLocalTransfer'
import { readRemoteEntry, resolveRemoteSymlink } from './remoteEntry'

/**
 * How long a just-finished download is given to reach its final size on disk.
 *
 * `sftp.download()` resolving means the last byte was handed to the transfer,
 * not that the write stream behind it has flushed: a stat taken immediately can
 * see a file still short of its size. Polled briefly rather than trusted once —
 * and only when the first look disagrees, so the happy path costs one stat.
 */
const ARRIVAL_SETTLE_ATTEMPTS = 5
const ARRIVAL_SETTLE_DELAY_MS = 200

/** The live SFTP transport, borrowed from the one member that publicly exposes its type. */
type SftpSession = SFTPPanelComponent['sftp']

/**
 * Every transfer between a remote path and a local file of our choosing.
 *
 * Goes through `PlatformService` rather than through hand-written
 * `FileDownload`/`FileUpload` subclasses. The published typings suggest those
 * methods always raise a file dialog, which is what led to the hand-written
 * ones; the installed app takes a path and then opens nothing (piège #48).
 *
 * What that buys, beyond less code: `startDownload()`/`startUpload()` publish
 * the transfer on `fileTransferStarted$`, and Tabby's tab bar subscribes to it
 * — so progress, the transfer list and cancellation come for free, on transfers
 * that until now ran completely invisibly.
 */
export class SftpTransfers {
    /**
     * The display name of the SSH tab this instance works for, shown on the
     * transfer lines. A plain mutable field rather than a constructor argument:
     * the browser component that owns this instance only learns its tab's name
     * after construction, when the host panel binds it.
     */
    sessionLabel: string|null = null

    constructor (
        private platform: PlatformService,
        private notifications: SidebarPlusNoticesService,
        private registry: SidebarPlusTransfersService,
    ) { }

    /**
     * Runs a transfer and tells the registry when it dies.
     *
     * A rejection here is the *only* sign that a transfer is over without
     * having finished — losing the SSH transport mid-download rejects the
     * promise, but leaves `isCancelled()` and `isComplete()` both false, so the
     * line would otherwise stay "en cours" for the rest of the session. The
     * error is re-thrown untouched: reporting is not handling, and every caller
     * already has its own idea of what to say.
     */
    private async report<T> (transfer: FileTransfer, run: () => Promise<T>): Promise<T> {
        try {
            return await run()
        } catch (error) {
            this.registry.markFailed(transfer, String((error as Error)?.message ?? error))
            throw error
        }
    }

    /**
     * Whether the installed app takes an imposed path.
     *
     * Read off the function's arity rather than a version number: the extra
     * parameter is the only thing that matters, and a version test would have
     * to guess which release introduced it. An older Tabby falls back to the
     * hand-written transfers, which still work — they just show no progress.
     */
    private get imposesPath (): boolean {
        return this.platform.startDownload.length >= 4
    }

    async download (sftp: SftpSession, remotePath: string, localPath: string, name: string, size: number, mode: number, context?: TransferContext): Promise<void> {
        if (this.imposesPath) {
            const transfer = await this.platform.startDownload(name, mode, size, localPath)
            if (!transfer) {
                throw new Error(`Le téléchargement de ${name} n'a pas pu démarrer`)
            }
            // The `fileTransferStarted$` subscription tracked it inside the call
            // above, without context — completed here, where it is known.
            this.registry.attachContext(transfer, {
                remotePath,
                sessionLabel: context?.sessionLabel ?? this.sessionLabel ?? undefined,
            })
            await this.report(transfer, () => sftp.download(remotePath, transfer))
            await this.verifyArrival(sftp, remotePath, localPath, name, size, transfer)
            return
        }
        const fallback: FileDownload = new LocalFileDownload(localPath, name, size, mode)
        await (fallback as LocalFileDownload).openForWriting()
        await sftp.download(remotePath, fallback)
        await this.verifyArrival(sftp, remotePath, localPath, name, size, null)
    }

    /**
     * Confirms that what `download()` wrote is actually at `localPath`, whole.
     *
     * This is the one route where the question is answerable at all: the
     * destination is a path this plugin chose. A drag-out served over HTTP has
     * no destination to inspect — that is what the `handover` state is for.
     *
     * The expected size comes from the caller's `readdir` listing, which can be
     * legitimately stale: a file rewritten remotely between the listing and the
     * download arrives at its *new* size. Before crying wolf, the entry is
     * re-read from the parent listing (never `stat()`, piège #50) and the local
     * size is accepted if it matches either figure. A remote re-read that fails
     * proves nothing either way and is not treated as a verdict.
     */
    private async verifyArrival (
        sftp: SftpSession,
        remotePath: string,
        localPath: string,
        name: string,
        expectedSize: number,
        transfer: FileTransfer|null,
    ): Promise<void> {
        let localSize: number|null = null
        for (let attempt = 0; attempt < ARRIVAL_SETTLE_ATTEMPTS; attempt++) {
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, ARRIVAL_SETTLE_DELAY_MS))
            }
            localSize = await fs.promises.stat(localPath).then(st => st.size).catch(() => null)
            if (localSize === expectedSize) {
                return
            }
        }
        if (localSize !== null) {
            const fresh = await readRemoteEntry(sftp, remotePath).catch(() => null)
            if (fresh && localSize === fresh.size) {
                return
            }
            // A symlink's listed size is the link's own — a couple dozen bytes —
            // while the download delivers the *target's* content. Resolving is
            // what keeps a perfectly sound copy from being called incomplete
            // (found by the very first run of this check, on lien-fichier).
            if (fresh?.isSymlink) {
                const target = await resolveRemoteSymlink(sftp, fresh).catch(() => null)
                if (target && localSize === target.size) {
                    return
                }
            }
        }
        const reason = localSize === null
            ? `aucun fichier à destination (${localPath})`
            : `${localSize} octets à destination, ${expectedSize} attendus`
        if (transfer) {
            this.registry.markUnsound(transfer, reason)
        }
        throw new Error(`${name} : arrivée non vérifiée — ${reason}`)
    }

    /**
     * Sends a local file back to a remote path, then restores its mode.
     *
     * The chmod is not a refinement: `SFTPSession.upload()` writes to
     * `<path>.tabby-upload` and renames it over the target *without ever
     * calling `getMode()`*, so the file that lands carries the temporary file's
     * mode — the server's umask. Every save of a `0755` script therefore
     * dropped it to a non-executable mode, silently. Restoring the mode we read
     * before the edit is the only thing that keeps a script runnable.
     */
    async upload (sftp: SftpSession, remotePath: string, localPath: string, name: string, size: number, mode: number, context?: TransferContext): Promise<void> {
        if (this.imposesPath) {
            const [transfer] = await this.platform.startUpload({ multiple: false }, [localPath])
            if (!transfer) {
                throw new Error(`L'envoi de ${name} n'a pas pu démarrer`)
            }
            this.registry.attachContext(transfer, {
                remotePath,
                sessionLabel: context?.sessionLabel ?? this.sessionLabel ?? undefined,
            })
            await this.report(transfer, () => sftp.upload(remotePath, transfer))
        } else {
            const fallback = new LocalFileUpload(localPath, name, size, mode)
            await fallback.openForReading()
            try {
                await sftp.upload(remotePath, fallback as FileUpload)
            } finally {
                fallback.close()
            }
        }
        // A mode of 0 means we never knew the original one; leave the server's
        // own default alone rather than clamping the file to nothing.
        if (!mode) {
            console.warn(`[better-sidebar] ${name} : mode inconnu (0), permissions non rétablies`)
            return
        }
        const permissions = mode & 0o7777
        try {
            await sftp.chmod(remotePath, permissions)
            console.info(`[better-sidebar] ${name} : chmod ${permissions.toString(8)} appliqué`)
        } catch (e) {
            // Said out loud, not swallowed: the file *was* written, but it no
            // longer carries the permissions it had. On a script, that is the
            // difference between runnable and not — the user has to know.
            console.error(`[better-sidebar] ${name} : chmod ${permissions.toString(8)} refusé`, e)
            this.notifications.error(
                `${name} a été renvoyé, mais ses permissions n'ont pas pu être rétablies (${permissions.toString(8)})`,
                String(e),
            )
        }
    }
}
