import * as path from 'path'
import { SFTPFile, SFTPPanelComponent } from 'tabby-ssh'

/** The live SFTP transport, borrowed from the one member that publicly exposes its type. */
type SftpSession = SFTPPanelComponent['sftp']

/**
 * Reads one remote entry — through `readdir`, never through `stat`.
 *
 * `SFTPSession.stat()` cannot be used to observe a file: russh builds its
 * result with `Object.assign({}, md)` on a **napi object**, whose accessors are
 * not own enumerable properties and are therefore not copied. Only `type` and
 * `size` are reassigned explicitly, so everything else comes back undefined —
 * `permissions` lands as mode `0`, and `mtime` as a date in **1970**. russh's
 * own `readDirectory()` copies each field by hand and carries the comment
 * "Can't just spread a napi object", which is precisely the mistake `stat()`
 * makes.
 *
 * The cost is a directory listing instead of a single round trip, and it is
 * unavoidable: permissions and modification time have no other source here, and
 * both are what tells a current copy from a stale one, or a file whose mode
 * must be restored after an upload.
 */
export async function readRemoteEntry (sftp: SftpSession, remotePath: string): Promise<SFTPFile|null> {
    const parent = path.posix.dirname(remotePath)
    const name = path.posix.basename(remotePath)
    const entries = await sftp.readdir(parent).catch(() => [] as SFTPFile[])
    return entries.find(entry => entry.name === name) ?? null
}

/** Longest symlink chain followed before concluding the link cannot be resolved. */
const MAX_SYMLINK_HOPS = 8

/**
 * Follows a symlink to the entry it really designates.
 *
 * Read through `readRemoteEntry()` — the parent directory's listing — and
 * never through `stat()`, whose mode comes back 0 and whose date comes back
 * 1970 (piège #50). The resolved entry is the one whose size, mode and mtime
 * mean anything: the link's own say nothing about what a download delivers.
 *
 * Returns null when the chain cannot be followed — a dangling link, a loop,
 * or a server that refuses `readlink`. Lifted out of the browser component
 * (2026-08-07) so the arrival check can resolve too; the component delegates.
 */
export async function resolveRemoteSymlink (sftp: SftpSession, item: SFTPFile): Promise<SFTPFile|null> {
    let current = item
    for (let hop = 0; hop < MAX_SYMLINK_HOPS; hop++) {
        if (!current.isSymlink) {
            return current
        }
        let next: SFTPFile|null = null
        try {
            const raw = await sftp.readlink(current.fullPath)
            const absolute = raw.startsWith('/')
                ? raw
                : path.posix.resolve(path.posix.dirname(current.fullPath), raw)
            next = await readRemoteEntry(sftp, absolute)
        } catch {
            return null
        }
        if (!next) {
            return null
        }
        current = next
    }
    return null
}
