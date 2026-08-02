import * as fs from 'fs'
import { FileDownload, FileUpload } from 'tabby-core'

/**
 * Adapters letting `SFTPSession.download()`/`.upload()` read and write a plain
 * local file.
 *
 * Those two methods take a `FileDownload`/`FileUpload`, and the only
 * implementations Tabby ships come from `PlatformService.startDownload()` and
 * `.startUpload()` — both of which pop a file picker. The edit round-trip needs
 * neither dialog: it knows exactly which temporary file it wants. Subclassing
 * rather than duck-typing is required, since `FileTransfer` is an abstract
 * class with private state, so a structurally identical object would not be
 * assignable.
 *
 * Going through `SFTPSession.upload()` rather than writing the remote file
 * directly is deliberate: it writes to `<path>.tabby-upload` first, so a
 * transfer interrupted halfway never leaves a truncated file on the server.
 *
 * It is not, however, atomic, and the difference matters: the sequence is
 * `unlink(path)` *then* `rename(temp, path)`, so a break between the two leaves
 * nothing at all, and the target's identity is replaced on every save — which
 * is what destroys a symlink rather than writing through it (see the roadmap's
 * chantier on editing through a symlink).
 */

/** Chunk size matching SFTPFileHandle.read()'s own, so neither side re-buffers. */
const CHUNK_SIZE = 256 * 1024

// Both classes stick to the members common to the npm typings and the app
// actually installed, which disagree here (piège #6): npm declares `getMode()`
// abstract on `FileTransfer`, so on downloads too, and knows nothing of
// `setTotalSize()`/`setStatus()`. Implementing the union and calling none of
// the newer helpers compiles against the old typings and runs against the new
// class. The progress helpers are no loss anyway — these transfers are not
// registered with any Tabby UI, so nothing would read them.

export class LocalFileDownload extends FileDownload {
    private handle: fs.promises.FileHandle|null = null

    constructor (
        private localPath: string,
        private name: string,
        private size: number,
        private mode: number,
    ) {
        super()
    }

    async openForWriting (): Promise<void> {
        this.handle = await fs.promises.open(this.localPath, 'w')
    }

    getName (): string {
        return this.name
    }

    getSize (): number {
        return this.size
    }

    /** Only the npm typings declare this on a download; the installed class has it on uploads alone. */
    getMode (): number {
        return this.mode
    }

    async write (buffer: Uint8Array): Promise<void> {
        if (!this.handle) {
            throw new Error('Le fichier local n’est pas ouvert en écriture')
        }
        await this.handle.write(buffer)
        this.increaseProgress(buffer.length)
    }

    close (): void {
        void this.handle?.close().catch(() => null)
        this.handle = null
    }

    override cancel (): void {
        super.cancel()
        this.close()
    }
}

/**
 * A zero-byte upload, used to create an empty remote file.
 *
 * `SFTPSession` has no "create file" of its own, and `open()` would need
 * russh's OPEN_WRITE/OPEN_CREATE flags — russh being a native module this
 * plugin cannot import. Handing an empty transfer to `upload()` gets there
 * through the public API instead: it opens the temp path with those flags
 * itself, reads one empty chunk, and renames into place.
 */
export class EmptyFileUpload extends FileUpload {
    constructor (private name: string, private mode: number) {
        super()
    }

    getName (): string {
        return this.name
    }

    getSize (): number {
        return 0
    }

    getMode (): number {
        return this.mode
    }

    /** Empty on the first call: that is how upload() detects end of stream. */
    async read (): Promise<Uint8Array> {
        return new Uint8Array(0)
    }

    close (): void {
        // Nothing to release.
    }
}

export class LocalFileUpload extends FileUpload {
    private handle: fs.promises.FileHandle|null = null
    private buffer = Buffer.alloc(CHUNK_SIZE)

    constructor (
        private localPath: string,
        private name: string,
        private size: number,
        private mode: number,
    ) {
        super()
    }

    async openForReading (): Promise<void> {
        this.handle = await fs.promises.open(this.localPath, 'r')
    }

    getName (): string {
        return this.name
    }

    getSize (): number {
        return this.size
    }

    getMode (): number {
        return this.mode
    }

    /** An empty chunk is how SFTPSession.upload() detects the end of the stream. */
    async read (): Promise<Uint8Array> {
        if (!this.handle) {
            throw new Error('Le fichier local n’est pas ouvert en lecture')
        }
        const { bytesRead } = await this.handle.read(this.buffer, 0, CHUNK_SIZE, null)
        if (bytesRead === 0) {
            return new Uint8Array(0)
        }
        this.increaseProgress(bytesRead)
        // A copy, not a subarray: the caller keeps the chunk while the next
        // read() overwrites this.buffer in place.
        return new Uint8Array(this.buffer.subarray(0, bytesRead))
    }

    close (): void {
        void this.handle?.close().catch(() => null)
        this.handle = null
    }

    override cancel (): void {
        super.cancel()
        this.close()
    }
}
