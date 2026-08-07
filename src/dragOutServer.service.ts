import * as crypto from 'crypto'
import * as http from 'http'
import { Injectable, NgZone } from '@angular/core'
import { FileDownload, PlatformService } from 'tabby-core'
import { SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { SidebarPlusDropLocator } from './dropLocator.service'
import { freeLocalName } from './localNames'
import { SidebarPlusNoticesService } from './notices.service'
import { readRemoteEntry } from './remoteEntry'
import { downloadRemoteTree } from './remoteTree'
import { SftpTransfers } from './transfers'
import { SidebarPlusTransfersService } from './transfersRegistry.service'

/** The live SFTP transport, borrowed from the one member that publicly exposes its type. */
type SftpSession = SFTPPanelComponent['sftp']

/**
 * Extension of the empty file the shell writes at the drop site.
 *
 * Visible to the user for the fraction of a second between the drop and the
 * sweep that removes it, so it says whose it is rather than looking like litter.
 */
const MARKER_EXTENSION = '.tabbydrop'

/**
 * An entry announced to the system, waiting to be claimed by a drop.
 *
 * Two shapes, because a `DownloadURL` carries exactly one file:
 *
 *   - `file` serves the real bytes, and the shell writes them wherever the drop
 *     landed. One gesture, nothing on disk beforehand, no idea where it went.
 *   - `marker` serves nothing at all — an empty body under a unique name. The
 *     shell writes *that* at the drop site, which is what lets the folder be
 *     found (see `SidebarPlusDropLocator`) and the payload delivered into it.
 *     This is how a directory leaves, since it cannot be a `DownloadURL` itself.
 */
interface Offer {
    kind: 'file'|'marker'
    sftp: SftpSession
    item: SFTPFile
    expiresAt: number
    /**
     * Display name of the SSH tab the offer came from, carried with the offer
     * because an `SFTPSession` knows nothing of its tab: by the time the drop
     * claims the offer, this is the only party that can still say whose it was.
     */
    sessionLabel?: string
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
    /**
     * True once the other end walked away before the file was whole.
     *
     * Chromium asks for the bytes *before* showing its "Save as" dialog, so
     * dismissing that dialog closes the connection on a transfer that has
     * already started. That is a user cancelling, not a transfer breaking —
     * the caller reads this to tell the two apart.
     */
    clientGone = false

    constructor (
        private response: http.ServerResponse,
        private item: SFTPFile,
    ) {
        super()
        // `close` fires either way; `writableFinished` is what says whether the
        // response got to say everything it had to say.
        this.response.on('close', () => {
            if (!this.response.writableFinished) {
                this.clientGone = true
            }
        })
        this.response.on('error', () => {
            this.clientGone = true
        })
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
        // Throwing is the only way out: `SFTPSession.download()` loops on
        // `read()`/`write()` and never consults `isCancelled()`, so cancelling
        // the transfer does not stop it — only an exception does. Without this,
        // a dismissed dialog left the loop reading the whole file out of the
        // server and writing it into a dead socket.
        if (this.clientGone || this.response.destroyed) {
            throw new Error('Téléchargement abandonné')
        }
        if (!this.response.write(Buffer.from(buffer))) {
            await this.awaitDrain()
        }
        this.increaseProgress(buffer.length)
    }

    /**
     * Waits for the socket buffer to empty, or gives up if the other end goes.
     *
     * Listening for `drain` alone is what hung: on a closed response that event
     * never comes, so the promise never settled and the transfer stayed
     * "en cours" for the rest of the session, holding its SFTP reads open.
     */
    private awaitDrain (): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const cleanup = (): void => {
                this.response.off('drain', onDrain)
                this.response.off('close', onGone)
                this.response.off('error', onGone)
            }
            const onDrain = (): void => {
                cleanup()
                resolve()
            }
            const onGone = (): void => {
                cleanup()
                reject(new Error('Téléchargement abandonné'))
            }
            this.response.once('drain', onDrain)
            this.response.once('close', onGone)
            this.response.once('error', onGone)
        })
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
    /** Transfers of the marker route, reported like every other transfer of the panel. */
    private fileTransfers: SftpTransfers

    constructor (
        private transfers: SidebarPlusTransfersService,
        private locator: SidebarPlusDropLocator,
        private notifications: SidebarPlusNoticesService,
        private zone: NgZone,
        platform: PlatformService,
    ) {
        // Built here rather than injected: `SftpTransfers` is a plain class the
        // SFTP panel constructs for itself, and the marker route needs the same
        // reporting — imposed path, progress in Tabby's own transfer list.
        this.fileTransfers = new SftpTransfers(platform, this.notifications, this.transfers)
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
        await new Promise<void>(resolve => {
            // Settled by whichever comes first. Listening only for `listening`
            // left this promise pending for the life of the window when the
            // socket failed to bind — nothing awaited it, but a promise that can
            // never settle is not something to leave lying around.
            const done = (): void => {
                server.off('listening', onListening)
                server.off('error', onError)
                resolve()
            }
            const onListening = (): void => done()
            const onError = (): void => { this.server = null; done() }
            server.once('listening', onListening)
            server.once('error', onError)
            // Port 0 asks the OS for a free one; '127.0.0.1' is what keeps this
            // off every other interface.
            server.listen(0, '127.0.0.1')
        })
        // Past the handshake, a late failure just closes the shop.
        server.on('error', () => { this.server = null })
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
    offer (sftp: SftpSession, item: SFTPFile, sessionLabel?: string): string|null {
        const announced = this.announce('file', sftp, item, sessionLabel)
        return announced?.url ?? null
    }

    /**
     * Announces an empty marker standing in for an entry that cannot be served
     * as bytes, and returns both the URL and the name to announce it under.
     *
     * The name matters as much as the URL here: it is what the shell writes at
     * the drop site, and therefore what the sweep looks for. Unique per gesture,
     * so two drags in flight cannot be confused for one another.
     */
    offerMarker (sftp: SftpSession, item: SFTPFile, sessionLabel?: string): { url: string, markerName: string }|null {
        const announced = this.announce('marker', sftp, item, sessionLabel)
        if (!announced) {
            return null
        }
        return { url: announced.url, markerName: announced.token + MARKER_EXTENSION }
    }

    private announce (kind: Offer['kind'], sftp: SftpSession, item: SFTPFile, sessionLabel?: string): { url: string, token: string }|null {
        if (!this.ready) {
            return null
        }
        this.pruneExpired()
        const token = crypto.randomBytes(24).toString('hex')
        this.offers.set(token, { kind, sftp, item, expiresAt: Date.now() + OFFER_TTL_MS, sessionLabel })
        return { url: `http://127.0.0.1:${this.port}/${token}`, token }
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
        // Every request is also a chance to forget what a drag abandoned an hour
        // ago: nothing else runs on a timer here, and a pending offer holds its
        // SFTP session alive.
        this.pruneExpired()
        if (!offer || offer.expiresAt < Date.now()) {
            res.writeHead(404)
            res.end()
            return
        }

        if (offer.kind === 'marker') {
            await this.serveMarker(token, offer, res)
            return
        }

        // The row the drag started from is a snapshot of the last `readdir`, and
        // the drop can land much later. Announcing that stale size would make
        // the header disagree with the body, which is exactly what tells the
        // other end the download is truncated. Asked again here — through the
        // listing, never `stat()` (piège #50) — and the offer is answered with
        // whatever the server says now. A read that fails is not fatal: the
        // snapshot is still the best guess available.
        const item = await readRemoteEntry(offer.sftp, offer.item.fullPath).catch(() => null) ?? offer.item

        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            // The length lets the receiving end know when the file is whole
            // rather than merely when the socket closed — which is what tells a
            // truncated transfer apart from a finished one. It buys no progress
            // UI: measured, Windows shows none. The bytes are written by
            // Chromium, as a download, and Electron surfaces no download
            // indicator of its own — hence the transfer panel below.
            'Content-Length': String(item.size),
            'Content-Disposition': `attachment; filename="${encodeURIComponent(item.name)}"`,
        })

        const transfer = new HttpFileDownload(res, item)
        // Announced here, not at `dragstart`: this is the moment the drop
        // actually happened and the bytes start moving. A gesture begun and
        // abandoned never shows up.
        //
        // Flagged as handing over, and this route is the only one that does:
        // serving the last byte hands the file to the shell, which still has to
        // write it where it was dropped — so "terminé" is not ours to announce
        // (piège #58). The marker route below is not concerned: there, the
        // download *is* the final write, at a path we chose.
        this.transfers.track(transfer, true, { remotePath: offer.item.fullPath, sessionLabel: offer.sessionLabel })
        try {
            await offer.sftp.download(offer.item.fullPath, transfer)
        } catch (error) {
            // No error page is possible — the headers are already out and the
            // body is half written. Killing the socket is what tells the other
            // side the file is incomplete.
            res.destroy()
            if (transfer.clientGone) {
                // The user dismissed the "Save as" dialog, or Chromium gave up:
                // nothing broke, so the line says "annulé" like any other
                // cancellation. `cancel()` is what the registry's tick reads.
                transfer.cancel()
                return
            }
            // Otherwise the transport died under the transfer, and the line
            // would stay "en cours" for good: nothing else ever cancels or
            // completes it.
            this.transfers.markFailed(transfer, String((error as Error)?.message ?? error))
        }
    }

    /**
     * Answers a marker request, then goes looking for where it landed.
     *
     * The request *is* the drop: the shell only fetches the URL once it has a
     * destination to write into. That is the signal no API gives — until this
     * moment nothing distinguishes a drag that was dropped from one that was
     * abandoned. The response is deliberately empty and answered at once; the
     * search and the delivery come after, because the shell is waiting on this
     * socket to finish writing the marker we are about to look for.
     */
    private async serveMarker (token: string, offer: Offer, res: http.ServerResponse): Promise<void> {
        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': '0',
        })
        res.end()

        const markerName = token + MARKER_EXTENSION
        const destination = await this.locator.locate(markerName)
        // Not found is not a failure to deliver: the drop happened, only its
        // folder is unknown — a target outside the swept places, or a shell that
        // took longer than the search allowed. Falling back is what makes the
        // entry arrive somewhere the user can find it rather than nowhere.
        const folder = destination ?? this.locator.fallbackFolder()
        if (!destination) {
            this.notify(`${offer.item.name} : dossier de dépôt introuvable, livré dans ${folder}`)
        }
        await this.deliver(offer, folder)
    }

    /**
     * Writes the announced entry into the folder the drop landed in.
     *
     * Collisions are not overwritten: this is a copy the user asked for by
     * dropping, and the panel's rule everywhere else is to refuse rather than
     * arbitrate — here refusing outright would leave the gesture with nothing to
     * show, so the copy is renamed the way Explorer does it.
     */
    private async deliver (offer: Offer, folder: string): Promise<void> {
        const target = this.freeName(folder, offer.item.name)
        try {
            const context = { sessionLabel: offer.sessionLabel }
            if (offer.item.isDirectory) {
                await downloadRemoteTree(
                    offer.sftp,
                    offer.item.fullPath,
                    target,
                    (remote, local, item) => this.fileTransfers.download(offer.sftp, remote, local, item.name, item.size, item.mode, context),
                )
            } else {
                await this.fileTransfers.download(
                    offer.sftp, offer.item.fullPath, target,
                    offer.item.name, offer.item.size, offer.item.mode, context,
                )
            }
            this.notify(`${offer.item.name} déposé dans ${folder}`)
        } catch (error) {
            this.notifyError(`${offer.item.name} n'a pas pu être déposé dans ${folder}`, String((error as Error)?.message ?? error))
        }
    }

    /** See `freeLocalName()` — one rule for every route that writes into a chosen folder. */
    private freeName (folder: string, name: string): string {
        return freeLocalName(folder, name)
    }

    /**
     * Everything here resumes outside the Angular zone.
     *
     * The HTTP request is a Node callback and the SFTP promises are native
     * bindings zone.js never patched, so a notice raised from this code would
     * mutate state nothing repaints (piège #41).
     */
    private notify (message: string): void {
        this.zone.run(() => this.notifications.notice(message))
    }

    private notifyError (message: string, detail: string): void {
        this.zone.run(() => this.notifications.error(message, detail))
    }

    /**
     * Stops listening and forgets every pending offer.
     *
     * Nothing calls this today, and that is deliberate rather than an oversight:
     * the service is `providedIn: 'root'`, so it lives as long as the window,
     * and tearing it down when the last SFTP panel closes would leave `ready`
     * false for good — the constructor is the only thing that ever starts the
     * server. What would otherwise justify the teardown is already covered:
     * the socket listens on the loopback interface only, on a port the OS
     * picks, each offer is a one-shot random token consumed before it is
     * served, and `pruneExpired()` drops anything a gesture abandoned.
     */
    dispose (): void {
        this.offers.clear()
        this.server?.close()
        this.server = null
        this.port = 0
    }
}
