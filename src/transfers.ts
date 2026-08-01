import { FileDownload, FileUpload, PlatformService } from 'tabby-core'
import { SFTPPanelComponent } from 'tabby-ssh'
import { LocalFileDownload, LocalFileUpload } from './sftpLocalTransfer'

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
    constructor (private platform: PlatformService) { }

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

    async download (sftp: SftpSession, remotePath: string, localPath: string, name: string, size: number, mode: number): Promise<void> {
        if (this.imposesPath) {
            const transfer = await this.platform.startDownload(name, mode, size, localPath)
            if (!transfer) {
                throw new Error(`Le téléchargement de ${name} n'a pas pu démarrer`)
            }
            await sftp.download(remotePath, transfer)
            return
        }
        const fallback: FileDownload = new LocalFileDownload(localPath, name, size, mode)
        await (fallback as LocalFileDownload).openForWriting()
        await sftp.download(remotePath, fallback)
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
    async upload (sftp: SftpSession, remotePath: string, localPath: string, name: string, size: number, mode: number): Promise<void> {
        if (this.imposesPath) {
            const [transfer] = await this.platform.startUpload({ multiple: false }, [localPath])
            if (!transfer) {
                throw new Error(`L'envoi de ${name} n'a pas pu démarrer`)
            }
            await sftp.upload(remotePath, transfer)
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
        if (mode) {
            await sftp.chmod(remotePath, mode & 0o7777).catch(() => null)
        }
    }
}
