/** Legacy SCP over Tabby's existing SSH transport. No SFTP or local scp binary. */
export interface SubscriptionLike { unsubscribe (): void }
export interface EventSource<T> {
    subscribe (observer: { next?: (value: T) => void, error?: (error: unknown) => void }): SubscriptionLike
}
export interface ExecChannel {
    data$: EventSource<Uint8Array>
    extendedData$: EventSource<[number, Uint8Array]>
    eof$: EventSource<void>
    closed$: EventSource<void>
    requestExec (command: string): Promise<void>
    write (data: Uint8Array): Promise<void>
    close (): Promise<void>
}
export interface ScpSession {
    ssh: unknown
    willDestroy$: EventSource<void>
}
interface ExecClient {
    openSessionChannel (): Promise<unknown>
    activateChannel (channel: unknown): Promise<ExecChannel>
}
export interface RemoteEntry { name: string, kind: 'd'|'f'|'x' }
export interface RemoteDirectory { path: string, entries: RemoteEntry[] }
export type Progress = (done: number, total: number) => void
export type OpenExec = (command: string, signal: AbortSignal) => Promise<ScpStream>
const CHUNK_SIZE = 64 * 1024
const MAX_BUFFER = 16 * 1024 * 1024
const MAX_LISTING = 4 * 1024 * 1024
const IDLE_MS = 30_000

export function shellQuote (value: string): string {
    if (value.includes('\0')) { throw new Error('NUL is not allowed in a remote path') }
    return "'" + value.replace(/'/g, "'\\''") + "'"
}

export function scpName (name: string): string {
    // SCP control records are newline-delimited. Never accept a path in a header.
    if (!name || name === '.' || name === '..' || /[\0\r\n/\\]/.test(name)) {
        throw new Error('This filename cannot be represented safely by legacy SCP')
    }
    return name
}

export function remoteFile (directory: string, name: string): string {
    scpName(name)
    if (!directory.startsWith('/') || /[\0\r\n]/.test(directory)) {
        throw new Error('SCP requires an absolute remote directory without line breaks')
    }
    return directory.replace(/\/+$/, '') + '/' + name
}

/** Bounded byte queue: never buffer a complete transfer or trust its declared size. */
export class ScpStream {
    private chunks: Buffer[] = []
    private buffered = 0
    private ended = false
    private disposed = false
    private error: Error|null = null
    private stderr = ''
    private wake: (() => void)|null = null
    private subscriptions: SubscriptionLike[] = []
    private timer: ReturnType<typeof setTimeout>|null = null
    private rejectFailure!: (error: Error) => void
    private failure = new Promise<never>((_, reject) => { this.rejectFailure = reject })
    private onAbort = (): void => this.fail(new Error('SCP operation cancelled'))

    constructor (private channel: ExecChannel, private signal: AbortSignal, private idleMs = IDLE_MS) {
        // A channel can fail while no read/write is pending.
        void this.failure.catch(() => undefined)
        this.subscriptions.push(channel.data$.subscribe({ next: data => {
            if (this.disposed || this.error) { return }
            this.touch()
            if (this.buffered + data.byteLength > MAX_BUFFER) {
                this.fail(new Error('SCP receive buffer limit exceeded'))
                return
            }
            if (data.byteLength) {
                this.chunks.push(Buffer.from(data))
                this.buffered += data.byteLength
                this.notify()
            }
        }, error: error => this.fail(asError(error)) }))
        this.subscriptions.push(channel.extendedData$.subscribe({ next: ([, data]) => {
            this.stderr = (this.stderr + Buffer.from(data).toString('utf8')).slice(-8192)
        }, error: error => this.fail(asError(error)) }))
        for (const event of [channel.eof$, channel.closed$]) {
            this.subscriptions.push(event.subscribe({ next: () => { this.ended = true; this.notify() }, error: error => this.fail(asError(error)) }))
        }
        signal.addEventListener('abort', this.onAbort, { once: true })
        this.touch()
        if (signal.aborted) { this.onAbort() }
    }

    private notify (): void { this.wake?.(); this.wake = null }
    private touch (): void {
        if (this.timer) { clearTimeout(this.timer) }
        if (!this.disposed && !this.error) {
            this.timer = setTimeout(() => this.fail(new Error('SCP operation timed out')), this.idleMs)
        }
    }
    private fail (error: Error): void {
        if (this.error || this.disposed) { return }
        this.error = error
        this.rejectFailure(error)
        this.notify()
        void this.channel.close().catch(() => undefined)
    }
    private check (): void {
        if (this.error) { throw this.error }
        if (this.disposed) { throw new Error('SCP channel is closed') }
    }
    async exec (command: string): Promise<void> {
        this.check()
        await Promise.race([this.channel.requestExec(command), this.failure])
    }
    async write (data: Uint8Array): Promise<void> {
        this.check()
        await Promise.race([this.channel.write(data), this.failure])
        this.touch()
    }
    async chunk (maximum = CHUNK_SIZE): Promise<Buffer|null> {
        while (true) {
            this.check()
            const first = this.chunks[0]
            if (first) {
                const count = Math.min(maximum, first.length)
                const result = first.subarray(0, count)
                if (count === first.length) { this.chunks.shift() } else { this.chunks[0] = first.subarray(count) }
                this.buffered -= count
                return result
            }
            if (this.ended) { return null }
            await new Promise<void>(resolve => { this.wake = resolve })
        }
    }
    private endedError (): Error {
        return new Error(this.stderr.trim() || 'SSH channel closed before SCP completed (check remote scp and shell access)')
    }
    async byte (): Promise<number> {
        const data = await this.chunk(1)
        if (!data) { throw this.endedError() }
        return data[0]
    }
    async line (first?: number): Promise<string> {
        const bytes: number[] = first === undefined ? [] : [first]
        while (bytes.length < 8192) {
            const byte = await this.byte()
            if (byte === 10) { return Buffer.from(bytes).toString('utf8') }
            bytes.push(byte)
        }
        throw new Error('SCP control record is too long')
    }
    async ack (): Promise<void> {
        const code = await this.byte()
        if (code === 0) { return }
        if (code === 1 || code === 2) { throw new Error(await this.line()) }
        throw new Error('Invalid SCP acknowledgement')
    }
    async body (size: number, consume: (data: Buffer) => Promise<void>, progress: Progress): Promise<void> {
        let done = 0
        progress(0, size)
        while (done < size) {
            const data = await this.chunk(Math.min(CHUNK_SIZE, size - done))
            if (!data) { throw this.endedError() }
            await Promise.race([consume(data), this.failure])
            done += data.length
            progress(done, size)
        }
    }
    async output (): Promise<Buffer> {
        const chunks: Buffer[] = []
        let size = 0
        for (let data = await this.chunk(); data; data = await this.chunk()) {
            size += data.length
            if (size > MAX_LISTING) { throw new Error('Remote directory listing is too large') }
            chunks.push(data)
        }
        return Buffer.concat(chunks)
    }
    diagnostic (): string { return this.stderr.trim() }
    close (): void {
        if (this.disposed) { return }
        this.disposed = true
        if (this.timer) { clearTimeout(this.timer) }
        this.signal.removeEventListener('abort', this.onAbort)
        this.subscriptions.forEach(subscription => subscription.unsubscribe())
        this.chunks = []
        this.buffered = 0
        this.notify()
        void this.channel.close().catch(() => undefined)
    }
}

function asError (error: unknown): Error { return error instanceof Error ? error : new Error(String(error)) }

/** Attach listeners BEFORE requestExec: a short command may answer immediately. */
export function sessionExec (session: ScpSession): OpenExec {
    return async (command, signal) => {
        const client = session.ssh as Partial<ExecClient>|null
        if (typeof client?.openSessionChannel !== 'function' || typeof client.activateChannel !== 'function') {
            throw new Error('This Tabby SSH backend does not expose exec channels for SCP')
        }
        if (signal.aborted) { throw new Error('SCP operation cancelled') }
        const controller = new AbortController()
        const abort = (): void => controller.abort()
        signal.addEventListener('abort', abort, { once: true })
        const subscription = session.willDestroy$.subscribe({ next: abort, error: abort })
        let stream: ScpStream|null = null
        let expired = false
        let timer: ReturnType<typeof setTimeout>|null = null
        let rejectOpening!: (error: Error) => void
        const failure = new Promise<never>((_, reject) => { rejectOpening = reject })
        const cancelOpening = (): void => { expired = true; rejectOpening(new Error('SCP operation cancelled')) }
        controller.signal.addEventListener('abort', cancelOpening, { once: true })
        if (controller.signal.aborted) { cancelOpening() }
        const cleanup = (): void => {
            if (timer) { clearTimeout(timer) }
            signal.removeEventListener('abort', abort)
            controller.signal.removeEventListener('abort', cancelOpening)
            subscription.unsubscribe()
        }
        try {
            timer = setTimeout(() => { expired = true; rejectOpening(new Error('Opening the SCP channel timed out')) }, IDLE_MS)
            const opening = client.openSessionChannel().then(channel => client.activateChannel!(channel)).then(channel => {
                if (expired || controller.signal.aborted) {
                    void channel.close().catch(() => undefined)
                    throw new Error('SCP operation cancelled')
                }
                return channel
            })
            const channel = await Promise.race([opening, failure])
            clearTimeout(timer)
            timer = null
            controller.signal.removeEventListener('abort', cancelOpening)
            stream = new ScpStream(channel, controller.signal)
            const close = stream.close.bind(stream)
            stream.close = () => { cleanup(); close() }
            await stream.exec(command)
            return stream
        } catch (error) {
            cleanup()
            stream?.close()
            throw error
        }
    }
}

/** POSIX shell only: no GNU find/stat, Python, PTY, or SFTP subsystem needed. */
export function listingCommand (path: string): string {
    if (!path || path.includes('\0')) { throw new Error('Invalid remote directory') }
    const script = 'CDPATH=; export CDPATH; cd "$1" || exit; [ -r . ] && [ -x . ] || exit 1; ' +
        'printf "%s\\000" "$PWD"; ' +
        'for f in ./* ./.[!.]* ./..?*; do ' +
        '[ -e "$f" ] || [ -L "$f" ] || continue; ' +
        'k=x; if [ -d "$f" ]; then k=d; elif [ -f "$f" ]; then k=f; fi; ' +
        'printf "%s\\000%s\\000" "$k" "${f#./}"; done'
    const argument = path.startsWith('-') ? './' + path : path
    // russh has no exit-status observable. An explicit trailer distinguishes
    // an empty directory from a failed cd/exec or truncated SSH output.
    return 'sh -c ' + shellQuote(script) + ' scp-browser ' + shellQuote(argument) +
        '; r=$?; printf "\\000SCP-LIST-STATUS\\000%s\\000" "$r"'
}

export function parseListing (output: Buffer): RemoteDirectory {
    const fields = output.toString('utf8').split('\0')
    if (fields.pop() !== '' || fields.pop() !== '0' || fields.pop() !== 'SCP-LIST-STATUS' || fields.pop() !== '') {
        throw new Error('Cannot list this directory: a POSIX shell and read/search permissions are required')
    }
    const path = fields.shift() ?? ''
    if (!path.startsWith('/') || fields.length % 2 !== 0) { throw new Error('Invalid remote directory listing') }
    const entries: RemoteEntry[] = []
    for (let index = 0; index < fields.length; index += 2) {
        const kind = fields[index]
        const name = fields[index + 1]
        if (!['d', 'f', 'x'].includes(kind) || !name || name === '.' || name === '..' || name.includes('/')) {
            throw new Error('Invalid remote directory entry')
        }
        entries.push({ kind: kind as RemoteEntry['kind'], name })
    }
    entries.sort((a, b) => Number(b.kind === 'd') - Number(a.kind === 'd') || a.name.localeCompare(b.name))
    return { path, entries }
}

export async function listDirectory (open: OpenExec, path: string, signal: AbortSignal): Promise<RemoteDirectory> {
    const stream = await open(listingCommand(path), signal)
    try {
        const output = await stream.output()
        try { return parseListing(output) } catch (error) {
            throw new Error(stream.diagnostic() || asError(error).message)
        }
    } finally { stream.close() }
}

export async function receiveFile (open: OpenExec, path: string, consume: (data: Buffer) => Promise<void>, signal: AbortSignal, progress: Progress): Promise<void> {
    const expectedName = scpName(path.slice(path.lastIndexOf('/') + 1))
    if (!path.startsWith('/') || /[\0\r\n]/.test(path)) { throw new Error('Invalid SCP path') }
    const stream = await open('scp -f ' + shellQuote(path), signal)
    try {
        await stream.write(Buffer.from([0]))
        const first = await stream.byte()
        if (first === 1 || first === 2) { throw new Error(await stream.line()) }
        const header = await stream.line(first)
        const match = /^C[0-7]{4} ([0-9]+) (.+)$/.exec(header)
        if (!match || match[2] !== expectedName) { throw new Error('Unexpected SCP file header or filename') }
        const size = Number(match[1])
        if (!Number.isSafeInteger(size) || size < 0) { throw new Error('Invalid SCP file size') }
        await stream.write(Buffer.from([0]))
        await stream.body(size, consume, progress)
        await stream.ack()
        await stream.write(Buffer.from([0]))
    } finally { stream.close() }
}

export async function sendFile (open: OpenExec, path: string, size: number, source: AsyncIterable<Buffer>, signal: AbortSignal, progress: Progress): Promise<void> {
    const name = scpName(path.slice(path.lastIndexOf('/') + 1))
    if (!path.startsWith('/') || /[\0\r\n]/.test(path) || !Number.isSafeInteger(size) || size < 0) {
        throw new Error('Invalid SCP path or file size')
    }
    const stream = await open('scp -t ' + shellQuote(path), signal)
    try {
        await stream.ack()
        await stream.write(Buffer.from(`C0600 ${size} ${name}\n`, 'utf8'))
        await stream.ack()
        let done = 0
        progress(0, size)
        for await (const data of source) {
            if (done + data.length > size) { throw new Error('Local file changed during upload') }
            await stream.write(data)
            done += data.length
            progress(done, size)
        }
        if (done !== size) { throw new Error('Local file was truncated during upload') }
        await stream.write(Buffer.from([0]))
        await stream.ack()
    } finally { stream.close() }
}
