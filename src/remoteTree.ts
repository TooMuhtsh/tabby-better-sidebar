import * as fs from 'fs'
import * as path from 'path'
import { SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { readRemoteEntry } from './remoteEntry'

/** The live SFTP transport, borrowed from the one member that publicly exposes its type. */
type SftpSession = SFTPPanelComponent['sftp']

/** How many files of a directory are fetched at once. See `downloadAll()`. */
const DOWNLOAD_CONCURRENCY = 4

/** Fetches one remote file into one local path. Supplied by the caller, which owns how a transfer is reported. */
export type FileFetcher = (remotePath: string, localPath: string, item: SFTPFile) => Promise<void>

/**
 * Copies a remote directory into a local one, depth first.
 *
 * A symlink to a *directory* is skipped, not followed: following it invites a
 * cycle (a link back to any ancestor would recurse forever), and there is no
 * realpath in `SFTPSession` to detect one with. A symlink to a file is
 * downloaded normally — the server resolves it, so the copy is the target's
 * content.
 *
 * Skipping is not cosmetic. Downloading a link-to-directory as a file makes the
 * server answer `Failure` (EISDIR), which would throw and fail the whole
 * directory: one link would make a perfectly ordinary tree undraggable. And the
 * entry's own flags cannot tell the two apart — `isDirectory` is false for any
 * symlink, and its `mode` describes the link. Only reading the *target*
 * answers, and only through its mode (piège #45) — read from the parent's
 * listing, never through `stat()`, see `targetIsDirectory()`.
 */
export async function downloadRemoteTree (
    sftp: SftpSession,
    remotePath: string,
    localPath: string,
    fetch: FileFetcher,
): Promise<void> {
    const files: { remote: string, local: string, item: SFTPFile }[] = []

    const walk = async (remote: string, local: string): Promise<void> => {
        await fs.promises.mkdir(local, { recursive: true })
        for (const entry of await sftp.readdir(remote)) {
            const childLocal = path.join(local, entry.name)
            if (entry.isDirectory) {
                await walk(entry.fullPath, childLocal)
                continue
            }
            if (entry.isSymlink && await targetIsDirectory(sftp, entry.fullPath)) {
                continue
            }
            files.push({ remote: entry.fullPath, local: childLocal, item: entry })
        }
    }

    // The whole tree is walked before anything is fetched: the directories have
    // to exist before their files land, and knowing the full list is what
    // allows the transfers to overlap at all.
    await walk(remotePath, localPath)
    await downloadAll(files.map(f => () => fetch(f.remote, f.local, f.item)))
}

/**
 * Runs the transfers a few at a time.
 *
 * Measured on 26 files totalling 11 MB: over a minute, while the same directory
 * through Tabby's own download is near-instant, and a single 10 MB file through
 * this very code path is too. So the cost is per *file*, not per byte — round
 * trips to open, read and close each one, which overlap perfectly well.
 * Strictly sequential, they simply queued.
 *
 * Bounded rather than unbounded: every transfer shares one SFTP channel, and a
 * hundred concurrent opens would trade one queue for another while making a
 * failure much harder to attribute.
 */
async function downloadAll (tasks: (() => Promise<void>)[]): Promise<void> {
    let next = 0
    const workers = Array.from(
        { length: Math.min(DOWNLOAD_CONCURRENCY, tasks.length) },
        async () => {
            while (next < tasks.length) {
                await tasks[next++]()
            }
        },
    )
    await Promise.all(workers)
}

/**
 * Whether a symlink points at a directory. A failure counts as "yes": the entry
 * is skipped rather than risking the whole copy on it.
 *
 * Resolved through the link and read from the *listing*, not from `stat()` —
 * whose mode is always 0 here, which left the mode test of piège #45
 * permanently false and the guard rail resting on `isDirectory` alone.
 */
async function targetIsDirectory (sftp: SftpSession, remotePath: string): Promise<boolean> {
    try {
        const target = await sftp.readlink(remotePath)
        const entry = await readRemoteEntry(sftp, path.posix.resolve(path.posix.dirname(remotePath), target))
        if (!entry) {
            return true
        }
        return entry.isDirectory || (entry.mode & 0o170000) === 0o040000
    } catch {
        return true
    }
}
