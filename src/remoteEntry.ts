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
