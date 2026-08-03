import { filesize } from 'filesize'
import { Injectable, NgZone } from '@angular/core'
import { ConfigService, FileDownload, FileTransfer, PlatformService } from 'tabby-core'

export type TransferDirection = 'up'|'down'
/**
 * `handover` sits between the last byte we serve and the file actually being
 * where the user dropped it — see `HANDOVER_BYTES_PER_MS`.
 */
export type TransferState = 'active'|'handover'|'done'|'cancelled'|'failed'

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
    /** What killed the transfer, shown on hover. Empty unless the state is `failed`. */
    failureReason: string
    /**
     * True when the last byte served is not the end of the story: the shell
     * still has to write the file where it was dropped.
     */
    handsOver: boolean
    /** When the handover is estimated to be over. Only meaningful while the state is `handover`. */
    handoverUntil: number
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

/**
 * Assumed rate of the shell's own copy, in bytes per millisecond (~200 MB/s).
 *
 * A drag-out served as a `DownloadURL` is not finished when our last byte
 * leaves: Chromium materialises the content into a temporary file and the shell
 * *copies* that to the drop site — 22 seconds of it, measured on 5.52 GB across
 * two volumes (piège #58). Announcing "terminé" at the end of our stream was
 * therefore a lie of exactly that length.
 *
 * Nothing signals the end of that copy: the shell never reports back, and the
 * destination is unknown on this route, so there is no file to watch either.
 * The wait is estimated from the size instead, deliberately on the slow side of
 * what was measured (250 MB/s) so the state ends late rather than early — the
 * whole point being to stop claiming a file is in place before it can be.
 * Approximate and accepted as such; a drop landing on the *same* volume is a
 * rename rather than a copy, and finishes long before this says so.
 */
const HANDOVER_BYTES_PER_MS = 200 * 1024

/** Floor on the handover, so a small file still shows the state rather than blinking through it. */
const HANDOVER_MIN_MS = 400

/** Ceiling, so a mis-estimate cannot leave a line stuck short of done. */
const HANDOVER_MAX_MS = 120_000

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
        private config: ConfigService,
        private zone: NgZone,
    ) {
        platform.fileTransferStarted$.subscribe(transfer => this.track(transfer))
    }

    /** Whether the transfers panel is on. Off means this service does nothing at all — no history, no tick. */
    get enabled (): boolean {
        return this.config.store.sidebarPlus?.showTransfers ?? true
    }

    get activeCount (): number {
        return this.entries.filter(entry => entry.state === 'active').length
    }

    /**
     * What still needs the tick to run — which is not the same as what can still
     * be cancelled.
     *
     * A line in `handover` has nothing left to interrupt on our side, so it does
     * not belong in `activeCount` (which drives "clearing will cancel them").
     * It does need the tick, though: its own end is a deadline nothing else
     * watches, and stopping the timer on the last *active* transfer would leave
     * it saying "remise au système" for the rest of the session.
     */
    private get runningCount (): number {
        return this.entries.filter(entry => entry.state === 'active' || entry.state === 'handover').length
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
    track (transfer: FileTransfer, handsOver = false): void {
        // The single gate for both feeds — `fileTransferStarted$` above and our
        // own callers here. Placed on the way in rather than at the panel: an
        // entry recorded for a switched-off panel would grow a list nobody can
        // reach and keep the 500 ms tick running for it. The transfer itself is
        // untouched; only its bookkeeping is declined.
        if (!this.enabled) {
            return
        }
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
                failureReason: '',
                handsOver,
                handoverUntil: 0,
            })
            this.refreshSummary()
            this.startTicking()
        })
    }

    /**
     * Marks a transfer that died instead of finishing.
     *
     * Nothing else can. The tick only ever reads `isCancelled()` and
     * `isComplete()`, and a transfer whose SSH transport disappeared answers
     * false to both: its line stayed `active` for good, frozen at whatever
     * percentage it had reached, speed decaying to zero — which reads as "still
     * going" for something that is over. Only the caller awaiting the transfer
     * sees the rejection, so the caller is who reports it here.
     */
    markFailed (transfer: FileTransfer, reason?: string): void {
        this.zone.run(() => {
            const entry = this.entries.find(candidate => candidate.transfer === transfer)
            if (!entry || entry.state !== 'active') {
                return
            }
            this.finish(entry, 'failed', Date.now())
            entry.failureReason = reason ?? ''
            this.refreshSummary()
            if (!this.runningCount) {
                this.stopTicking()
            }
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
        // Counted with the active ones: a handover is not finished, and the
        // badge exists to say whether anything still is not.
        const active = this.runningCount
        const done = this.entries.filter(entry => entry.state === 'done').length
        const cancelled = this.entries.filter(entry => entry.state === 'cancelled').length
        const failed = this.entries.filter(entry => entry.state === 'failed').length
        // A failure outranks the plain total even when nothing is running: it is
        // the one state the user has to know about without opening the list.
        this.summary = active > 0
            ? `${active} en cours`
            : failed > 0 ? `${failed} interrompu${failed > 1 ? 's' : ''}` : String(this.entries.length)
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
        if (failed > 0) {
            parts.push(failed > 1 ? `${failed} interrompus` : '1 interrompu')
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
            // Our part is over; only the estimated wait is left to run down.
            if (entry.state === 'handover') {
                if (now >= entry.handoverUntil) {
                    this.finish(entry, 'done', now)
                } else {
                    stillRunning = true
                }
                continue
            }
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
                if (entry.handsOver) {
                    entry.handoverUntil = now + this.handoverDuration(entry.size)
                    this.finish(entry, 'handover', now)
                    stillRunning = true
                    continue
                }
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

    /** How long the shell is assumed to need to put a file of this size in place. */
    private handoverDuration (size: number): number {
        const estimate = size / HANDOVER_BYTES_PER_MS
        return Math.min(HANDOVER_MAX_MS, Math.max(HANDOVER_MIN_MS, estimate))
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
        if (!this.runningCount) {
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
