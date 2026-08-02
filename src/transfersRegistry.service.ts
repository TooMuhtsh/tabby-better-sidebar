import { filesize } from 'filesize'
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
    percent: number
    /** Bytes per second, smoothed here rather than read from the transfer — see `tick()`. */
    speed: number
    state: TransferState
    /** Formatted once: the size never changes, and formatting it per pass would be the very mistake above. */
    sizeLabel: string
    speedLabel: string
    /** Time since the drop, counting up. Frozen at the final duration once the transfer ends. */
    elapsedLabel: string
    /** Empty whenever it cannot be told honestly: unknown size, stalled, or already over. */
    etaLabel: string
    startedAtMs: number
    lastBytes: number
    lastTickAt: number
}

/** How often the visible figures are recomputed while something is running. */
const TICK_MS = 500

/**
 * Weight of the newest sample in the smoothed speed.
 *
 * Low on purpose. The point of smoothing is the ETA: a figure that swings
 * between 3 and 50 seconds is worse than none, and SFTP throughput is naturally
 * lumpy — a chunk served from cache lands in a millisecond, the next waits on
 * the network.
 */
const SPEED_SMOOTHING = 0.25

/** `1:07`, `12:05`, `1:02:33` — minutes and seconds, hours only when there are any. */
function formatDuration (totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds))
    const hours = Math.floor(s / 3600)
    const minutes = Math.floor(s % 3600 / 60)
    const seconds = s % 60
    const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0')
    return `${hours > 0 ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`
}

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
    /** What the header badge shows — a field, not a getter, for the reason given above. */
    summary = ''
    /** The full breakdown, on hover: the badge itself only has room for what matters now. */
    summaryTitle = ''
    private counter = 0
    private timer: ReturnType<typeof setInterval>|null = null

    constructor (
        platform: PlatformService,
        private zone: NgZone,
    ) {
        platform.fileTransferStarted$.subscribe(transfer => this.track(transfer))
    }

    get activeCount (): number {
        return this.entries.filter(entry => entry.state === 'active').length
    }

    /**
     * Shows a transfer this plugin started itself.
     *
     * `fileTransferStarted$` above covers everything that goes through
     * `PlatformService`, which is most things — but not a transfer we construct
     * ourselves, like the one serving a drag-and-drop out of the panel. Feeding
     * that one to the native stream instead would have two unwanted effects:
     * Tabby's own transfers dropdown *opens itself* on every emission, and its
     * list is only ever emptied by clicking each line, so a hidden menu would
     * accumulate entries nobody can reach.
     */
    track (transfer: FileTransfer): void {
        this.zone.run(() => {
            const size = transfer.getSize()
            const now = Date.now()
            this.entries.unshift({
                id: this.counter++,
                transfer,
                direction: transfer instanceof FileDownload ? 'down' : 'up',
                name: transfer.getName(),
                size,
                percent: 0,
                speed: 0,
                state: 'active',
                sizeLabel: size > 0 ? String(filesize(size)) : '',
                speedLabel: '',
                elapsedLabel: formatDuration(0),
                etaLabel: '',
                startedAtMs: now,
                lastBytes: 0,
                lastTickAt: now,
            })
            this.refreshSummary()
            this.startTicking()
        })
    }

    /**
     * Says what is happening rather than just how many lines there are.
     *
     * A bare count next to the title read as "Transferts2" and told nothing:
     * two running? two finished? The badge now spells out the state that is
     * worth acting on — something still in flight — and falls back to the plain
     * total when everything is over, the breakdown moving to the tooltip.
     */
    private refreshSummary (): void {
        const active = this.entries.filter(entry => entry.state === 'active').length
        const done = this.entries.filter(entry => entry.state === 'done').length
        const cancelled = this.entries.filter(entry => entry.state === 'cancelled').length
        this.summary = active > 0 ? `${active} en cours` : String(this.entries.length)
        const parts: string[] = []
        if (active > 0) {
            parts.push(`${active} en cours`)
        }
        if (done > 0) {
            parts.push(done > 1 ? `${done} terminés` : '1 terminé')
        }
        if (cancelled > 0) {
            parts.push(cancelled > 1 ? `${cancelled} annulés` : '1 annulé')
        }
        this.summaryTitle = parts.join(', ')
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
        const now = Date.now()
        for (const entry of this.entries) {
            if (entry.state !== 'active') {
                continue
            }
            if (entry.transfer.isCancelled()) {
                this.finish(entry, 'cancelled', now)
                continue
            }
            const completed = entry.transfer.getCompletedBytes()
            entry.percent = entry.size > 0 ? Math.min(100, Math.round(completed / entry.size * 100)) : 0
            entry.elapsedLabel = formatDuration((now - entry.startedAtMs) / 1000)
            this.updateSpeed(entry, completed, now)
            // `isComplete()` alone is not enough for a zero-byte transfer,
            // whose completed/size ratio never moves off 0.
            if (entry.transfer.isComplete() || (entry.size > 0 && completed >= entry.size)) {
                entry.percent = 100
                this.finish(entry, 'done', now)
                continue
            }
            stillRunning = true
        }
        this.refreshSummary()
        if (!stillRunning) {
            this.stopTicking()
        }
    }

    /**
     * Recomputes the smoothed speed, and from it the ETA.
     *
     * The transfer's own `getSpeed()` is not used: it reports the last chunk's
     * rate, measured between two `increaseProgress()` calls, so it swings by an
     * order of magnitude from one chunk to the next. Averaging over the bytes
     * that actually moved between two ticks is both steadier and independent of
     * how the transport happens to chop the stream up.
     */
    private updateSpeed (entry: TransferEntry, completed: number, now: number): void {
        const seconds = (now - entry.lastTickAt) / 1000
        if (seconds > 0) {
            const instant = Math.max(0, completed - entry.lastBytes) / seconds
            entry.speed = entry.speed > 0
                ? entry.speed * (1 - SPEED_SMOOTHING) + instant * SPEED_SMOOTHING
                : instant
        }
        entry.lastBytes = completed
        entry.lastTickAt = now
        entry.speedLabel = entry.speed > 0 ? `${filesize(entry.speed, { round: 1 })}/s` : ''

        // Left blank rather than guessed: with no size there is nothing to
        // subtract from, and a stalled transfer would otherwise show an ETA
        // growing towards infinity.
        const remaining = entry.size - completed
        entry.etaLabel = entry.size > 0 && remaining > 0 && entry.speed > 0
            ? formatDuration(remaining / entry.speed)
            : ''
    }

    /** Freezes a finished line: the duration it took, and no figure that keeps moving. */
    private finish (entry: TransferEntry, state: TransferState, now: number): void {
        entry.state = state
        entry.elapsedLabel = formatDuration((now - entry.startedAtMs) / 1000)
        entry.etaLabel = ''
        entry.speedLabel = ''
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
        this.refreshSummary()
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
        this.refreshSummary()
        this.stopTicking()
    }
}
