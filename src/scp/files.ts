import { promises as fs } from 'fs'
import { basename, dirname, join } from 'path'
import { randomBytes } from 'crypto'
import { OpenExec, Progress, receiveFile, remoteFile, sendFile, shellQuote } from './protocol'

function checkCancelled (signal: AbortSignal): void {
    if (signal.aborted) { throw new Error('SCP operation cancelled') }
}

/** Write a sibling temporary file, then rename. A failed download never truncates the destination. */
export async function downloadFile (open: OpenExec, remote: string, local: string, signal: AbortSignal, progress: Progress): Promise<void> {
    checkCancelled(signal)
    const temporary = join(dirname(local), '.tabby-scp-' + randomBytes(12).toString('hex') + '.part')
    const handle = await fs.open(temporary, 'wx', 0o600)
    let closed = false
    try {
        await receiveFile(open, remote, async data => {
            let offset = 0
            while (offset < data.length) {
                checkCancelled(signal)
                const { bytesWritten } = await handle.write(data, offset, data.length - offset)
                if (!bytesWritten) { throw new Error('Could not write the downloaded file') }
                offset += bytesWritten
            }
        }, signal, progress)
        checkCancelled(signal)
        await handle.close()
        closed = true
        checkCancelled(signal)
        await fs.rename(temporary, local)
    } finally {
        if (!closed) { await handle.close().catch(() => undefined) }
        await fs.unlink(temporary).catch(() => undefined)
    }
}

/** Upload to a random sibling first, so cancellation cannot damage an existing remote file. */
export async function uploadFile (open: OpenExec, local: string, directory: string, signal: AbortSignal, progress: Progress): Promise<void> {
    checkCancelled(signal)
    const target = remoteFile(directory, basename(local))
    const temporary = remoteFile(directory, '.tabby-scp-' + randomBytes(12).toString('hex') + '.part')
    const handle = await fs.open(local, 'r')
    let started = false
    try {
        const stat = await handle.stat()
        if (!stat.isFile()) { throw new Error('Select a regular file; recursive folder transfers are not supported') }
        async function * source (): AsyncGenerator<Buffer> {
            let remaining = stat.size
            while (remaining > 0) {
                checkCancelled(signal)
                const buffer = Buffer.alloc(Math.min(64 * 1024, remaining))
                const { bytesRead } = await handle.read(buffer, 0, buffer.length, null)
                if (!bytesRead) { throw new Error('Local file was truncated during upload') }
                remaining -= bytesRead
                yield buffer.subarray(0, bytesRead)
            }
        }
        started = true
        await sendFile(open, temporary, stat.size, source(), signal, progress)
        checkCancelled(signal)
        const script = 'if [ -d ' + shellQuote(target) + ' ]; then exit 1; fi; mv -f ' +
            shellQuote(temporary) + ' ' + shellQuote(target)
        const command = 'sh -c ' + shellQuote(script) + '; r=$?; printf "\\000SCP-MOVE-STATUS\\000%s\\000" "$r"'
        const stream = await open(command, signal)
        try {
            const result = await stream.output()
            if (result.toString('utf8') !== ('\0SCP-MOVE-STATUS\0' + '0\0')) {
                throw new Error(stream.diagnostic() || 'Could not move the uploaded file into place')
            }
        } finally { stream.close() }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(started ? `${message}\nA temporary file may remain on the server: ${temporary}` : message)
    } finally { await handle.close() }
}
