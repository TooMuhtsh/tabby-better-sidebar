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
 * Per-window directories are what keeps one window's copies apart from
 * another's.
 *
 * They are *not* enough to make the startup purge safe with several windows
 * open, contrary to what this said until 2026-08-02: `process.uptime()` is the
 * age of the current renderer, not of the application, so a window opened at
 * 10:30 treats the 10:00 window's directory as predating "boot" and deletes it
 * — including a file being edited right then, after which the watcher has
 * nothing left to send. See the "Cycle de vie" chantier in the roadmap; the fix
 * is not settled, and this note is here so the flaw is not rediscovered from
 * the symptom.
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
     * Removes what earlier runs left behind.
     *
     * The cutoff is the moment this process started, not an age in hours: a
     * directory created before Tabby launched cannot belong to anything still
     * running, whereas a fixed age would eventually delete a long editing
     * session's own copy.
     */
    private async purgeStale (): Promise<void> {
        const bootTime = Date.now() - process.uptime() * 1000
        const entries = await fs.promises.readdir(ROOT, { withFileTypes: true }).catch(() => [])
        for (const entry of entries) {
            const dir = path.join(ROOT, entry.name)
            const stat = await fs.promises.stat(dir).catch(() => null)
            if (stat && stat.mtimeMs < bootTime) {
                await this.remove(dir)
            }
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
