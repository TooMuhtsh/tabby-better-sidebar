import { Injectable, NgZone } from '@angular/core'
import { FileDownload, FileTransfer, PlatformService } from 'tabby-core'

export type TransferDirection = 'up'|'down'
export type TransferState = 'active'|'done'|'cancelled'

/**
 * One line of the panel.
 *
 * Every displayed value is a plain field, refreshed on a tick — never a call
 * into the transfer from the template. A getter there would be re-evaluated on
 * every change detection pass, and Tabby runs a great many of them (piège #54).
 */
export interface TransferEntry {
    id: number
    transfer: FileTransfer
    direction: TransferDirection
    name: string
    size: number
    /** Formatted once: it never changes, and formatting it per pass would be the very mistake above. */
    startedAt: string
    percent: number
    speed: number
    state: TransferState
}

/** How often the visible figures are recomputed while something is running. */
const TICK_MS = 500

/**
 * Every file transfer of the application, as the sidebar shows them.
 *
 * Fed by `fileTransferStarted$` — the same stream Tabby's own tab bar
 * subscribes to — rather than by a registry of our own. That is what the
 * roadmap's option (c) proposed, and it means this panel reflects *all*
 * transfers, including those started by the native SFTP panel or another
 * plugin, not just the ones this plugin initiates.
 *
 * Completed entries are kept as history until dismissed, in memory only:
 * `config.yaml` has no business growing a transfer log, and neither has
 * localStorage.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusTransfersService {
    entries: TransferEntry[] = []
    private counter = 0
    private timer: ReturnType<typeof setInterval>|null = null

    constructor (
        platform: PlatformService,
        private zone: NgZone,
    ) {
        platform.fileTransferStarted$.subscribe(transfer => this.add(transfer))
    }

    get activeCount (): number {
        return this.entries.filter(entry => entry.state === 'active').length
    }

    private add (transfer: FileTransfer): void {
        this.zone.run(() => {
            this.entries.unshift({
                id: this.counter++,
                transfer,
                direction: transfer instanceof FileDownload ? 'down' : 'up',
                name: transfer.getName(),
                size: transfer.getSize(),
                startedAt: new Date().toLocaleTimeString(),
                percent: 0,
                speed: 0,
                state: 'active',
            })
            this.startTicking()
        })
    }

    /**
     * Runs only while something is in flight.
     *
     * A permanent interval would trigger a change detection pass twice a second
     * for a panel that is idle almost always — the exact cost this panel was
     * asked to avoid paying elsewhere.
     */
    private startTicking (): void {
        if (this.timer) {
            return
        }
        this.timer = setInterval(() => this.tick(), TICK_MS)
    }

    private tick (): void {
        let stillRunning = false
        for (const entry of this.entries) {
            if (entry.state !== 'active') {
                continue
            }
            if (entry.transfer.isCancelled()) {
                entry.state = 'cancelled'
                continue
            }
            const completed = entry.transfer.getCompletedBytes()
            entry.speed = entry.transfer.getSpeed()
            entry.percent = entry.size > 0 ? Math.min(100, Math.round(completed / entry.size * 100)) : 0
            // `isComplete()` alone is not enough for a zero-byte transfer,
            // whose completed/size ratio never moves off 0.
            if (entry.transfer.isComplete() || (entry.size > 0 && completed >= entry.size)) {
                entry.state = 'done'
                entry.percent = 100
                continue
            }
            stillRunning = true
        }
        if (!stillRunning) {
            this.stopTicking()
        }
    }

    private stopTicking (): void {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    /**
     * Drops one line — cancelling it first when it is still running.
     *
     * Same semantics as Tabby's own transfers menu: removing a live transfer
     * *stops* it rather than just hiding it, which is the only reading that
     * does not leave an invisible transfer writing to a server.
     */
    remove (entry: TransferEntry): void {
        if (entry.state === 'active') {
            entry.transfer.cancel()
        }
        this.entries = this.entries.filter(candidate => candidate !== entry)
        if (!this.activeCount) {
            this.stopTicking()
        }
    }

    /** Clears the list. Live transfers are cancelled — the caller asks first. */
    clear (): void {
        for (const entry of this.entries) {
            if (entry.state === 'active') {
                entry.transfer.cancel()
            }
        }
        this.entries = []
        this.stopTicking()
    }
}
