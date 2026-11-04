# Optional SCP panel

Enable **Show SCP panel** (Italian: **Mostra pannello SCP**) using the checkbox
immediately below the Profiles / SFTP selector in Better Sidebar. It is off by
default and persisted through the `sidebarPlusScp.enabled` configuration key.
The panel is independent of SFTP: turning off the existing SFTP view does not
turn off SCP. No SFTP fallback is used by this feature.

Open an SSH session, enable the checkbox, and select the session in the SCP
panel. The initially focused SSH pane is selected when possible. Subsequent
terminal focus changes do not silently change the chosen transfer target.
Browse by entering a path or clicking a folder; `..` goes to its parent. Hidden
files are included. Use the filter, **Upload file**, or the download button on
a regular file. The native save dialog selects the local download destination.
Uploads always ask for confirmation and show the full remote destination.

The existing SFTP panel, profiles view, and transfer manager are unchanged.
SCP progress and cancellation appear in the new panel, not in the SFTP transfer
manager. Unchecking the checkbox, disabling the plugin, replacing a connection,
or closing its SSH session cancels pending work and releases its channels.

## Requirements and compatibility

- The server must allow SSH exec channels, a POSIX-compatible login shell,
  `sh`, and a `scp` executable. Browsing uses shell built-ins, not SFTP,
  GNU `find`/`stat`, Python, or a pseudo-terminal. Finalizing an upload also
  requires `mv` and write/search permissions on the destination directory.
- SCP-only appliances that disallow shell commands, Windows SSH servers without
  a POSIX shell, and restricted `ForceCommand` accounts may not support this
  browser even when a standalone SCP transfer works.
- The implementation uses the authenticated russh transport exposed by current
  Tabby SSH sessions (`openSessionChannel` / `activateChannel`). Unsupported
  backends report an error rather than trying SFTP or collecting credentials.
  Authentication and host-key handling remain with the already-open Tabby
  session; the plugin neither copies passwords nor spawns a local `scp` binary.
- Remote `scp -f` and `scp -t` run the legacy SCP source/sink protocol directly.
  This does not invoke the local OpenSSH `scp` client whose modern default is
  SFTP, so no local `-O` flag or local SCP installation is required.

## Initial scope and safety

This is a single-regular-file browser and transfer panel, not a complete WinSCP
replacement. Recursive directory transfer, drag-and-drop, remote editing,
permission editing, deletion, resuming, and timestamp preservation are not
implemented. File symlinks are followed by the server; directory symlinks can
be browsed. Unsupported special files cannot be downloaded from the panel.

SCP control records cannot safely represent line breaks. Transfers reject NUL,
CR/LF, path separators in basenames, and backslashes; paths containing CR/LF
cannot be transferred. The browser assumes UTF-8 names. Downloads validate the
server-supplied name against the exact requested basename and do not accept
server-supplied paths or recursive records. Shell arguments are single-quoted.

Transfers are streamed in bounded chunks, with a 16 MiB receive queue limit,
a 4 MiB directory-listing output limit, and a 30-second idle timeout. An exceeded
limit or timeout is reported as an error; it never silently falls back to SFTP.

Downloads go into a random sibling `.tabby-scp-*.part` file and replace the
selected local destination only after SCP completes. Failed downloads remove
the temporary file on a best-effort basis. Uploads similarly use a random remote
sibling first, then `mv` it into place after the final SCP acknowledgement.
Uploaded files use mode **0600**; replacing an existing file does **not** preserve
its old permissions or inode. Replacing a symlink replaces the link rather than
writing into its target. Remote directories are not overwritten.

A failed or cancelled upload can leave its temporary remote file behind. The
error includes its path for manual cleanup; the plugin does not run additional
remote deletion commands after cancellation. A lost connection during the final
rename can leave the final outcome uncertain: refresh and inspect the destination.

## Verification

After installing the repository's development dependencies:

```sh
node --test tests/scp.test.cjs
npm run build
```

The tests use the actual SCP parser, stream, filesystem staging, and component
logic with simulated SSH channels and host services. POSIX quoting/listing tests
also execute local `sh`; those tests are skipped when `sh` is not available.
They do not connect to external servers. They cover binary/empty transfers,
fragmented records, malicious names, errors, truncation, cancellation, channel
cleanup, saved checkbox state, reconnection, and default-off behavior.

A full Angular/webpack build and an interactive Tabby session still need to be
verified on a development installation. Suggested smoke test: use a disposable
SSH server with its SFTP subsystem disabled, enable SCP, browse hidden files,
upload/download a binary file, compare hashes, cancel a transfer, reconnect, and
check that switching the checkbox/plugin off removes the panel without orphaned
channels. Repeat on Windows with native open/save dialogs and on a normal SFTP
server to confirm the existing SFTP panel remains usable. This implementation has
not been tested against the user's server.
