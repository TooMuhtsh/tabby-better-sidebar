import { Injectable, NgZone } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { SSHTabComponent } from 'tabby-ssh'

/** What the dot next to a session shows. */
export type PingState = 'good'|'fair'|'poor'|'unknown'|'unavailable'

/** Above these, in milliseconds, the dot changes colour. Deliberately not configurable yet — nobody has asked for a threshold, and two numbers in the settings page would need explaining. */
const FAIR_ABOVE_MS = 80
const POOR_ABOVE_MS = 250

/** The last round trip measured on a session, and when. */
interface PingSample {
    ms: number
    at: number
}

/**
 * Round-trip latency of the live SSH sessions, measured on the sessions
 * themselves.
 *
 * There is nothing to read: neither Tabby nor russh keeps a round-trip time
 * anywhere (checked on the installed bundle — russh's only mention of
 * keepalives is the interval handed to `connect()`, which reports nothing
 * back). So the number has to be produced, and the choice of how says what the
 * dot actually means.
 *
 * A timed SFTP request on the session's own channel, rather than an ICMP ping
 * or a TCP connect to port 22:
 *
 *   - it measures the *encrypted round trip of this session* — the delay that
 *     is felt when typing — where ICMP measures the host and is commonly
 *     filtered outright, which would show red on a perfectly good link;
 *   - it opens nothing. A TCP probe would start, then abandon, a connection
 *     before authentication on every tick: a trail in the server's auth log,
 *     and a plausible way to get banned by one's own fail2ban;
 *   - no external process, unlike `ping.exe`, once per session per tick.
 *
 * Two consequences to know about. The channel is shared with real SFTP work
 * (`SSHSession.openSFTP()` caches one channel per session), so a probe sent
 * during a large transfer queues behind its data and reads high — that is the
 * session genuinely being slow to answer, not a wrong measurement. And a
 * server with no SFTP subsystem cannot be measured at all: that session is
 * marked unavailable once and never probed again.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusPingService {
    private samples = new Map<SSHTabComponent, PingSample>()
    /** Probes in flight, so a slow answer cannot pile up behind itself. */
    private inFlight = new Set<SSHTabComponent>()
    /** Sessions whose server has no SFTP subsystem — asked once, never again. */
    private unavailable = new WeakSet<SSHTabComponent>()

    constructor (
        private config: ConfigService,
        private zone: NgZone,
    ) { }

    /** 0 disables the whole thing, which is the default — see the settings tab. */
    get intervalMs (): number {
        return Math.max(0, Number(this.config.store.sidebarPlus?.pingIntervalSeconds ?? 0)) * 1000
    }

    /**
     * Called on the tree's existing 2s poll, once per live session: no timer of
     * its own, on purpose. The tunnels list is refreshed the same way, and a
     * second interval in the sidebar is a second thing to remember to stop.
     */
    poll (tabs: SSHTabComponent[]): void {
        const interval = this.intervalMs
        if (!interval) {
            // Measurements go stale the moment the feature is switched off:
            // showing the last known latency of a session nobody is measuring
            // any more would be a number with no date on it.
            if (this.samples.size) {
                this.samples.clear()
            }
            return
        }
        const live = new Set(tabs)
        for (const tab of this.samples.keys()) {
            if (!live.has(tab)) {
                this.samples.delete(tab)
            }
        }
        const now = Date.now()
        for (const tab of tabs) {
            const sample = this.samples.get(tab)
            if (!sample || now - sample.at >= interval) {
                void this.probe(tab)
            }
        }
    }

    state (tab: SSHTabComponent): PingState {
        if (this.unavailable.has(tab)) {
            return 'unavailable'
        }
        const sample = this.samples.get(tab)
        if (!sample) {
            return 'unknown'
        }
        if (sample.ms > POOR_ABOVE_MS) {
            return 'poor'
        }
        return sample.ms > FAIR_ABOVE_MS ? 'fair' : 'good'
    }

    /**
     * The last measured round trip, or null when there is none — probing off,
     * first probe not back yet, or a server that opens no SFTP channel.
     *
     * The raw number rather than a sentence: the tooltip that shows it is a
     * compact `profil | 13 ms | 1m 47s`, so the wording belongs to the caller
     * and a placeholder here would have to be dropped by it anyway.
     */
    latencyMs (tab: SSHTabComponent): number|null {
        return this.samples.get(tab)?.ms ?? null
    }

    /**
     * One round trip on the session's SFTP channel.
     *
     * `stat('.')` is used as a *ping*, not as an observation: nothing in the
     * answer is read, only the time it took to come back. That distinction
     * matters here, because `stat()` is banned everywhere else in this codebase
     * for observing an entry — it answers mode 0 and a 1970 date (piège #50) —
     * and this is not that. It is the smallest request the protocol has: one
     * packet out, one small packet back, no directory listing.
     */
    private async probe (tab: SSHTabComponent): Promise<void> {
        if (this.inFlight.has(tab) || this.unavailable.has(tab)) {
            return
        }
        this.inFlight.add(tab)
        try {
            // The two failures are caught separately, because only one of them
            // is permanent. A channel that never opens means a server with no
            // SFTP subsystem: stop asking, for good. A request that fails on an
            // open channel is a session dropping mid-probe — transient, and the
            // tab is about to leave the list on its own, so the next tick may
            // well succeed. Neither is worth a notification.
            let sftp: Awaited<ReturnType<typeof tab.sshSession.openSFTP>>
            try {
                sftp = await tab.sshSession!.openSFTP()
            } catch {
                this.zone.run(() => {
                    this.unavailable.add(tab)
                    this.samples.delete(tab)
                })
                return
            }
            const started = Date.now()
            try {
                await sftp.stat('.')
            } catch {
                return
            }
            const ms = Date.now() - started
            // russh resolves outside Angular's zone — the browser build of
            // zone.js does not patch Node's promises, so the dot would keep its
            // old colour until something else triggered a cycle (piège #41).
            this.zone.run(() => {
                this.samples.set(tab, { ms, at: Date.now() })
            })
        } finally {
            this.inFlight.delete(tab)
        }
    }
}
