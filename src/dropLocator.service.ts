import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFile } from 'child_process'
import { Injectable } from '@angular/core'

/**
 * How long to keep looking for a marker after the drop was served.
 *
 * The shell writes it as part of the drop, so it normally appears within a
 * fraction of a second — but a slow disk, an antivirus filter or a network
 * share can delay it. Past this, the drop is treated as landed somewhere we
 * cannot see.
 */
const SEARCH_TIMEOUT_MS = 10_000

/** Gap between sweeps. Short enough to feel immediate, long enough not to spin. */
const SWEEP_INTERVAL_MS = 300

/** Guard rail on the candidate set: a folder with thousands of children is not a drop target worth expanding. */
const MAX_CHILDREN_PER_ROOT = 200

/**
 * Finds out where a drag-out was dropped, by looking for what the shell wrote.
 *
 * Windows never tells the source application where a drop landed: it serves a
 * `DownloadURL` through the shell, which fetches the URL and writes the file
 * itself, so Chromium — and therefore Electron — only ever sees the request
 * (piège #58). The way around it is to stop announcing the payload and announce
 * a **uniquely named empty marker** instead: the shell writes *that* into the
 * drop folder, and finding it is what reveals the folder.
 *
 * This is a heuristic and is documented as one. It sweeps the places a drop
 * plausibly lands — the desktop, the downloads folder, every open Explorer
 * window, and one level of subdirectories of each, because dropping onto a
 * folder *icon* inside a window lands inside that folder. A drop anywhere else
 * is not found, and the caller falls back to a known directory rather than
 * failing.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusDropLocator {
    /**
     * Waits for `markerName` to appear in one of the plausible drop folders.
     *
     * Returns the folder that received it, having deleted the marker; `null` if
     * it never turned up. Deletion is best effort: a marker held open by the
     * shell still identifies the right folder, so a failure to remove it is not
     * a failure to locate.
     */
    async locate (markerName: string): Promise<string|null> {
        const candidates = await this.candidateFolders()
        const deadline = Date.now() + SEARCH_TIMEOUT_MS
        while (Date.now() < deadline) {
            for (const dir of candidates) {
                const marker = path.join(dir, markerName)
                if (!fs.existsSync(marker)) {
                    continue
                }
                try {
                    fs.unlinkSync(marker)
                } catch {
                    // Locked by the shell — it is still the folder we were after.
                }
                return dir
            }
            await new Promise(resolve => setTimeout(resolve, SWEEP_INTERVAL_MS))
        }
        return null
    }

    /** Where a file is delivered when the drop folder cannot be found. */
    fallbackFolder (): string {
        return path.join(os.homedir(), 'Downloads')
    }

    /**
     * The folders worth sweeping, widest first.
     *
     * Built once per drop rather than per sweep: enumerating shell windows
     * costs a process launch, and the set of open windows does not meaningfully
     * change between two sweeps 300 ms apart.
     */
    private async candidateFolders (): Promise<string[]> {
        const roots = new Set<string>([
            this.fallbackFolder(),
            path.join(os.homedir(), 'Desktop'),
            ...await this.explorerFolders(),
        ])
        const all = new Set<string>(roots)
        for (const root of roots) {
            // Only one level down: a drop onto a folder icon lands inside it,
            // but going deeper would turn every sweep into a directory walk.
            for (const child of this.childDirectories(root)) {
                all.add(child)
            }
        }
        return [...all]
    }

    private childDirectories (root: string): string[] {
        try {
            return fs.readdirSync(root, { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .slice(0, MAX_CHILDREN_PER_ROOT)
                .map(entry => path.join(root, entry.name))
        } catch {
            // Unreadable or gone — not a drop target we can check.
            return []
        }
    }

    /**
     * Paths of every open Explorer window.
     *
     * Asked of the shell itself through COM, which is the only thing that knows
     * them. There is no Node API for this and no Electron one either, hence the
     * out-of-process hop; measured at ~50 ms on the development machine, paid
     * once per drop.
     *
     * A window showing a virtual location (This PC, a search result) has no
     * filesystem path and throws on `Self.Path`; those are skipped rather than
     * failing the enumeration.
     */
    private explorerFolders (): Promise<string[]> {
        const script = '(New-Object -ComObject Shell.Application).Windows() | '
            + 'ForEach-Object { try { $_.Document.Folder.Self.Path } catch {} }'
        return new Promise<string[]>(resolve => {
            execFile(
                'powershell',
                ['-NoProfile', '-NonInteractive', '-Command', script],
                { windowsHide: true, timeout: 5000 },
                (_error, stdout) => resolve(
                    String(stdout ?? '')
                        .split(/\r?\n/)
                        .map(line => line.trim())
                        // A virtual folder answers with a shell path (`::{GUID}`),
                        // which is not something `fs` can look into.
                        .filter(line => line.length > 0 && !line.startsWith('::')),
                ),
            )
        })
    }
}
