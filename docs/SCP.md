# Optional SCP panel

Enable **Show SCP panel** (Italian: **Mostra pannello SCP**) below the
Profiles / SFTP selector. The preference is off by default and persisted in
`sidebarPlusScp.enabled`. SCP remains independent of the SFTP setting and uses
the selected, already authenticated SSH session. It never opens an SFTP channel.

## Files and folders

- **Upload files** supports multiple files; **Upload folder** supports whole
  folder trees, including hidden files and empty subdirectories. The selected
  folder itself is created inside the current remote directory.
- Drop local files or folders onto the file list to upload into the current
  remote directory, or onto a folder row to upload inside that folder. Native
  Electron paths are resolved before any upload; unsupported drops fail visibly
  and can be retried with the upload buttons.
- The download button is available on both files and folders. Clicking a folder
  name still navigates into it. For a folder download choose its local parent
  directory. A fresh folder is created; existing names get ` (2)`, ` (3)`, etc.
  No existing local folder is merged into or overwritten.
- Upload confirmation lists all remote targets. Existing remote directories
  are merged and identically named files replaced. This is NOT a mirror/sync:
  unrelated remote files are never deleted.

Tree discovery completes before that tree's payloads are transferred. Payloads
use the existing legacy SCP file engine, with quoted POSIX shell commands for
listing and directory creation. No local scp executable is required. Progress
for a folder is file-weighted; it is not a total-byte estimate. Cancellation also
works during tree discovery. Switching session, reconnecting, disabling the
panel or destroying it invalidates the current operation.

## Safety and limitations

Symbolic links (including file links), junctions reported as links, and special
files are skipped during recursive copying and reported in the completion
summary. They are not followed or recreated. Selecting a link itself as an
upload root is rejected. This is deliberately more conservative than SFTP's
file-symlink behavior. Names unsafe for legacy SCP, invalid Windows filenames,
and case/normalization collisions on case-insensitive platforms are rejected,
not silently renamed. Trees are limited to 100000 entries and 64 levels.

A failed folder download removes only the fresh local folder reserved for that
operation. Existing local data is untouched. A cancelled/failed folder upload
can leave completed files and directories remotely; the error gives the root
path. It does not roll back or delete existing server contents. A failed file
upload may leave its random `.tabby-scp-*.part` file, as reported by the engine.
The copied tree is not a filesystem snapshot: concurrent changes can fail a
transfer, and the entire folder is not an atomic transaction.

Files still use the single-file engine's permissions (`0600`); newly created
folders use `0700` subject to platform support. Ownership, timestamps, ACLs,
extended attributes and executable modes are not preserved. The remote host
must permit SSH exec and provide a POSIX shell, `scp`, `mkdir` and `mv`.

This does not yet make SCP identical to the SFTP panel: dragging remote files
out to the OS, remote-editor save-back, remote moves/renames/deletion, metadata
columns and integration into the shared SFTP transfer registry are not included.
The new drag-and-drop support is local-to-remote only.

## Verification

Run `node --test tests/scp.test.cjs tests/scp-tree.test.cjs` after installing the
project's development dependencies. The new tests exercise the real recursive
and single-file modules against simulated SCP channels and local POSIX shell
commands, without network access. They cover nested/empty/hidden content, large
listings, binary files, conflicts, cancellation, unsafe names and symlink loops.
They do not replace a full webpack build or a Tabby/server integration test.
