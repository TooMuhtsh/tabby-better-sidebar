import * as crypto from 'crypto'
import * as http from 'http'
import { Injectable } from '@angular/core'
import { FileDownload } from 'tabby-core'
import { SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { SidebarPlusTransfersService } from './transfersRegistry.service'

/** The live SFTP transport, borrowed from the one member that publicly exposes its type. */
type SftpSession = SFTPPanelComponent['sftp']

/** A file announced to the system, waiting to be claimed by a drop. */
interface Offer {
    sftp: SftpSession
    item: SFTPFile
    expiresAt: number
}

/**
 * How long an announced file stays claimable.
 *
 * Long enough for a hesitant drop, short enough that a gesture abandoned an
 * hour ago cannot still be served.
 */
const OFFER_TTL_MS = 10 * 60 * 1000

/**
 * Streams a remote file straight into an HTTP response.
 *
 * The point of the whole mechanism: nothing is written to disk here. The bytes
 * go from the SFTP channel into the response, and Chromium writes them wherever
 * the file was dropped.
 */
class HttpFileDownload extends FileDownload {
    constructor (
        private response: http.ServerResponse,
        private item: SFTPFile,
    ) {
        super()
    }

    getName (): string {
        return this.item.name
    }

    getSize (): number {
        return this.item.size
    }

    getMode (): number {
        return this.item.mode
    }

    /**
     * Honours back pressure: `res.write()` returning false means the socket
     * buffer is full, and ignoring it would pull the whole file into memory —
     * which on a 4 GB video is the difference between a transfer and a crash.
     */
    async write (buffer: Uint8Array): Promise<void> {
        if (!this.response.write(Buffer.from(buffer))) {
            await new Promise<void>(resolve => this.response.once('drain', () => resolve()))
        }
        this.increaseProgress(buffer.length)
    }

    close (): void {
        this.response.end()
    }

    override cancel (): void {
        super.cancel()
        this.response.destroy()
    }
}

/**
 * A real drag-and-drop out of the panel: the transfer starts **on drop**.
 *
 * `webContents.startDrag()` cannot do this — it demands a file that already
 * exists locally, which is what forced the two-step gesture (prepare, then
 * drag). Chromium has another route: a `DownloadURL` entry in the drag's
 * `DataTransfer` announces a name, a type and a URL, and the content is only
 * fetched when the drop lands. That is Windows' own delayed-rendering
 * behaviour, reached through the engine rather than through an Electron API.
 *
 * This server is the other end of that URL. It listens on the loopback
 * interface only, on an ephemeral port, and answers exactly one request per
 * randomly generated token — a URL that has been served, or was never handed
 * out, is a 404. Nothing is reachable from the network, and no listing exists.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusDragOutServer {
    private server: http.Server|null = null
    private port = 0
    private offers = new Map<string, Offer>()

    constructor (
        private transfers: SidebarPlusTransfersService,
    ) {
        // Started eagerly: `dragstart` is synchronous and cannot wait for a
        // listening socket, so the port has to be known before the first
        // gesture. Failing to start is not fatal — the caller falls back to the
        // copy-then-drag path.
        void this.start()
    }

    private async start (): Promise<void> {
        if (this.server) {
            return
        }
        const server = http.createServer((req, res) => void this.handle(req, res))
        server.on('error', () => { this.server = null })
        await new Promise<void>(resolve => {
            // Port 0 asks the OS for a free one; '127.0.0.1' is what keeps this
            // off every other interface.
            server.listen(0, '127.0.0.1', () => resolve())
        })
        const address = server.address()
        if (address && typeof address === 'object') {
            this.server = server
            this.port = address.port
        }
    }

    /** True once a URL can be handed out — checked before offering, never assumed. */
    get ready (): boolean {
        return !!this.server && this.port > 0
    }

    /**
     * Announces a file and returns the URL that will serve it.
     *
     * Synchronous by necessity: it is called from `dragstart`, where an `await`
     * would let the gesture start without the announcement.
     */
    offer (sftp: SftpSession, item: SFTPFile): string|null {
        if (!this.ready) {
            return null
        }
        this.pruneExpired()
        const token = crypto.randomBytes(24).toString('hex')
        this.offers.set(token, { sftp, item, expiresAt: Date.now() + OFFER_TTL_MS })
        return `http://127.0.0.1:${this.port}/${token}`
    }

    private pruneExpired (): void {
        const now = Date.now()
        for (const [token, offer] of this.offers) {
            if (offer.expiresAt < now) {
                this.offers.delete(token)
            }
        }
    }

    private async handle (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const token = (req.url ?? '').replace(/^\//, '').split('?')[0]
        const offer = this.offers.get(token)
        // Consumed on the way out, before anything is served: a token answers
        // once. A retried or replayed request finds nothing.
        this.offers.delete(token)
        if (!offer || offer.expiresAt < Date.now()) {
            res.writeHead(404)
            res.end()
            return
        }

        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            // The length lets the receiving end know when the file is whole
            // rather than merely when the socket closed — which is what tells a
            // truncated transfer apart from a finished one. It buys no progress
            // UI: measured, Windows shows none. The bytes are written by
            // Chromium, as a download, and Electron surfaces no download
            // indicator of its own — hence the transfer panel below.
            'Content-Length': String(offer.item.size),
            'Content-Disposition': `attachment; filename="${encodeURIComponent(offer.item.name)}"`,
        })

        const transfer = new HttpFileDownload(res, offer.item)
        // Announced here, not at `dragstart`: this is the moment the drop
        // actually happened and the bytes start moving. A gesture begun and
        // abandoned never shows up.
        this.transfers.track(transfer)
        try {
            await offer.sftp.download(offer.item.fullPath, transfer)
        } catch {
            // No error page is possible — the headers are already out and the
            // body is half written. Killing the socket is what tells the other
            // side the file is incomplete.
            res.destroy()
        }
    }

    /** Called when the last panel goes away: stops listening and forgets every pending offer. */
    dispose (): void {
        this.offers.clear()
        this.server?.close()
        this.server = null
        this.port = 0
    }
}
