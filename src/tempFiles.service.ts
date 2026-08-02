import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { Injectable } from '@angular/core'

/** Everything this plugin writes to the temp directory lives under here. */
const ROOT = path.join(os.tmpdir(), 'tabby-better-sidebar')

/**
 * Temporary copies: where they go, and when they are removed.
 *
 * Both the remote editor and the drag-out keep local copies of remote files.
 * Until now they were only removed when the SFTP panel was destroyed, so
 * anything left by a crash, a `taskkill` or a plain window close stayed on disk
 * for good.
 *
 * Two mechanisms, deliberately unequal:
 *
 *   - **On startup**, anything older than this process is deleted. This is the
 *     one that matters: it is the only one that catches a run which ended
 *     without executing a single line of our code.
 *   - **On `beforeunload`**, this window's own directory goes. Not on
 *     `windowCloseRequest$`, which fires *before* the close is confirmed — a
 *     cancelled close would have deleted the copy of a file still open in the
 *     user's editor.
 *
 * Per-window directories keep one window's copies apart from another's, and the
 * purge decides what to delete by asking whether the process that owns a
 * directory is **still running** — its pid is right there in the name.
 *
 * That question replaced a boot-time cutoff, which was wrong as soon as a second
 * window existed: `process.uptime()` is the age of the *current renderer*, not
 * of the application, so a window opened at 10:30 treated the 10:00 window's
 * directory as predating "boot" and deleted it — including a file being edited
 * right then, after which the watcher had nothing left to send and every save
 * went silently nowhere.
 *
 * A pid can be recycled by an unrelated process, which would make us keep a
 * directory one run too long. That is the harmless side of the trade: this
 * class exists to avoid leaving copies behind, never to risk deleting one that
 * is in use.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusTempFilesService {
    private sessionDir = path.join(ROOT, `${process.pid}-${Date.now()}`)
    private counter = 0

    constructor () {
        void this.purgeStale()
        window.addEventListener('beforeunload', () => this.purgeSession())
    }

    /** A fresh, empty directory for one file. */
    async makeDir (kind: 'drag'|'edit'): Promise<string> {
        const dir = path.join(this.sessionDir, kind, String(this.counter++))
        await fs.promises.mkdir(dir, { recursive: true })
        return dir
    }

    /** Drops a directory handed out by `makeDir()`; missing is not an error. */
    async remove (dir: string): Promise<void> {
        await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => null)
    }

    /**
     * Removes what runs that are over left behind.
     *
     * A directory is fair game only when the process named in it is gone. Our
     * own is skipped explicitly rather than relying on it looking alive: it is
     * the one case where being wrong would delete the copies of the window
     * doing the deleting.
     */
    private async purgeStale (): Promise<void> {
        const entries = await fs.promises.readdir(ROOT, { withFileTypes: true }).catch(() => [])
        for (const entry of entries) {
            const dir = path.join(ROOT, entry.name)
            if (dir === this.sessionDir) {
                continue
            }
            const pid = Number(entry.name.split('-')[0])
            // A name we did not write: no owner can be read from it, so leave it
            // alone rather than guess.
            if (!Number.isInteger(pid) || pid <= 0) {
                continue
            }
            if (!SidebarPlusTempFilesService.isProcessAlive(pid)) {
                await this.remove(dir)
            }
        }
    }

    /**
     * Whether a pid still belongs to a running process.
     *
     * Signal 0 performs the permission and existence checks without delivering
     * anything. `EPERM` means the process is there but out of reach — alive for
     * our purposes, and the answer that errs towards keeping a directory.
     */
    private static isProcessAlive (pid: number): boolean {
        try {
            process.kill(pid, 0)
            return true
        } catch (e) {
            return (e as NodeJS.ErrnoException).code === 'EPERM'
        }
    }

    /**
     * Synchronous on purpose: `beforeunload` does not wait for a promise, so an
     * async removal would simply not happen. A copy still held open by an
     * external editor raises EBUSY on Windows — ignored, the startup purge will
     * get it next time.
     */
    private purgeSession (): void {
        try {
            fs.rmSync(this.sessionDir, { recursive: true, force: true })
        } catch {
            // Left for the next startup purge.
        }
    }
}
