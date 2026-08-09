<div align="center">

# 📁 tabby-better-sidebar

**Enhanced connection sidebar for [Tabby](https://tabby.sh)** — pinned
favourites, live connection status, drag & drop, and a contextual SFTP browser
living *inside* the sidebar rather than in a separate docked panel.

[![License: MIT](https://img.shields.io/github/license/TooMuhtsh/tabby-better-sidebar?color=0d9488)](LICENSE)
[![Part of Better Tabby](https://img.shields.io/badge/part%20of-Better%20Tabby-0d9488)](#-better-tabby-the-plugin-family)

</div>

---

Tabby ships a native profile sidebar, but it is not exported for third-party
plugins to reuse. This plugin rebuilds it and adds pinned favourites, live
connection status, drag & drop across folders, named workspaces, SSH tunnel
management, snippets, notes, and a full SFTP browser that lives in the
sidebar's own space and follows whichever SSH tab has focus.

**Every block is independent, and each one can be switched off** from the
plugin's settings tab — if you never use SSH tunnels or workspaces, turn those
two off and the sidebar gets that much lighter. Nothing is deleted when you do:
your favourites, workspaces and snippets stay exactly where they are, they just
stop being displayed.

## 🧩 Better Tabby, the plugin family

This plugin is one half of **Better Tabby**, a small family of independent
plugins that happen to share one settings tab instead of scattering several:

| | Plugin | Adds |
|---|---|---|
| 📁 | **tabby-better-sidebar** *(this repo)* | Pinned favourites, live connection status, drag & drop, workspaces, contextual SFTP browser |
| 🔐 | **[tabby-better-vault](https://github.com/TooMuhtsh/tabby-better-vault)** | Automatic vault unlock via your OS keychain |

**Neither plugin requires the other.** Install just this one and it behaves
exactly as if the other didn't exist — its own settings tab, nothing shared.
Install both, and they elect one of themselves to host a single **Better
Tabby** tab, each still rendering its own page inside it. No npm dependency
between the two repos, no shared code: just a small string contract
(`BetterPanelContribution:<id>`) each plugin recognises independently.

## ✨ The profile tree

- **Pinned favourites**, for both profiles and folders
- **Live connection status** per profile, with an optional latency indicator —
  a timed SFTP round trip on the session's own channel, not an ICMP ping, so it
  measures the delay you actually feel when typing
- **Active sessions** section at the top, one row per pane rather than per tab,
  with uptime, a click to focus and a shortcut to that session's SFTP view
- **Recent profiles** — the five most recently launched, all types together
  (off by default)
- **Drag & drop** reordering — profiles and folders, including moving a profile
  between folders and re-parenting a folder
- **Workspaces**: hide profiles and folders per workspace (personal / work /
  project), each with its own favourites, its own sibling order, its own icon
  and an optional contextual colour; a tabs-or-dropdown selector, and one-click
  JSON export/import
- **Multiple selection**, for acting on several profiles at once
- **SSH tunnels**: a panel of what Tabby is currently forwarding, badges on the
  profiles that declare tunnels, and a modal to add, edit or remove them —
  including a memory of tunnels a dropped session failed to bring back
- **Quick filter bar**, searching name, description, host and username —
  including inside what a workspace currently hides
- **Right-click menus**, grouped into `Manage` and `More` submenus so they stay
  short: create and delete folders and profiles, clone a profile, rename, pick
  an icon, attach snippets and notes, share a folder, hide it in the current
  workspace

## 🎨 Icons

The icon picker searches three sources at once, entirely offline — no network
call is ever made:

- **Font Awesome**, the set Tabby itself uses
- **[Iconify](https://iconify.design)** Material Design Icons and Tabler, for
  generic glyphs
- **[dashboard-icons](https://github.com/homarr-labs/dashboard-icons)** —
  around 2 400 logos of self-hosted services (Proxmox, Pi-hole, Nextcloud and
  the like), far more telling than a generic glyph for naming a real estate of
  machines. Icons that ship several palettes offer them as small dots on their
  tile, so a dark logo can be swapped for its light variant on a dark theme.

Recently used icons stay at hand, any icon can be pinned as a favourite with a
right click, and custom SVGs can be imported (sanitised with
[DOMPurify](https://github.com/cure53/DOMPurify)).

The two large icon collections are loaded **on the first search only**, in a
separate bundle, so they cost nothing at startup.

## 📂 SFTP

The browser replaces the profile tree in the sidebar's own space and follows
whichever SSH tab has focus — each tab remembers where it was, and the view can
be **frozen** on one session so it stops following the focused tab.

- **Configurable columns** (size, date, octal and long permissions, type,
  extension), folders-first sorting, hidden files toggle, zebra striping
- **Multiple selection**, files *and* folders, for bulk delete and move
- **Chunked loading** of large directory listings
- **Double-click opens a file in a code editor**, never through the OS file
  association — so double-clicking an executable edits it instead of running it.
  Saving sends the file back automatically, checking first that the remote copy
  has not changed in the meantime, and restoring its permissions afterwards.
  Symbolic links are resolved, so it is the target that gets edited, not the
  link
- **"Open with…"** stays available, but only from the context menu
- **Create, rename and delete** entries — `Delete` key included, with an HTML
  confirmation whose default button you choose in the settings
- **Move entries** by dragging them onto a folder — a server-side rename,
  nothing transits
- **Drag a file out to the OS**: the download starts when you drop it, wherever
  you dropped it
- **Transfer manager** at the bottom of the sidebar — progress, speed, ETA and
  elapsed time per transfer, an arrival check that flags a copy that did not
  land whole, cancel confirmation, visible from both views, hidden when empty
- **Optional auto-refresh** of the listing, off by default
- **Auto-return** to the profile view once no tab has an active SFTP session

## 📝 Snippets, notes and sharing

- **Snippets** — a command written once, attached to a profile, a folder, or
  everything, and reusable wherever it is attached. Supports `{{name}}`
  placeholders (required) and `{{name=default}}` (pre-filled), inherits down
  the folder tree, and can be set to write into the terminal, write and press
  Enter, or launch the session first
- **Notes** — a free-form memo per profile or folder, with a badge in the tree
- **Share a folder** through the clipboard, as JSON, at two levels: *with*
  connection details for your own machines, or *without credentials* for
  someone else. Passwords, login scripts, proxy commands and vault key
  references never travel, at either level; what was removed is stated in the
  notice, and the JSON is re-checked field by field when pasted back

## 🌍 Languages

The interface follows Tabby's language — English, plus French, Spanish and
German, covering the whole plugin: profile tree, context menus, active sessions
and tunnels, SFTP browser, dialogs, transfers and the settings tab. Any other
locale falls back to English.

## Elsewhere

- <kbd>Ctrl</kbd>+<kbd>Enter</kbd> inserts a line break in the terminal instead
  of submitting
- A dedicated settings tab under Tabby's own settings (shared as **Better
  Tabby** when the vault plugin is also installed)

## 📦 Installation

**Requires Tabby 1.0.231 or newer** — developed and tested against **Tabby
1.0.235**, the current stable release.

In Tabby, open **Settings → Plugins**, search for `better-sidebar` and install
it, then restart Tabby completely.

<details>
<summary>With npm directly</summary>

```bash
# In Tabby's plugin directory: %APPDATA%\tabby\plugins on Windows,
# ~/.config/tabby/plugins on macOS/Linux
npm install tabby-better-sidebar
```

Then restart Tabby completely.

</details>

## ⚙️ Configuration

Everything lives in **Settings → Better Sidebar** (or **Better Tabby → 📁
Sidebar** if `tabby-better-vault` is also installed), split into *General*,
*Features* and *Snippets*. On disk, the settings sit under `sidebarPlus` in
Tabby's own `config.yaml`.

<details>
<summary>Every setting, with its default</summary>

**Blocks** — each one switches on independently:

| Setting | Default | Effect |
|---|---|---|
| `enabled` | `true` | Shows the sidebar. Off, it disappears without uninstalling anything; this settings page stays reachable |
| `showActiveSessions` | `true` | Open SSH connections, at the top of the sidebar |
| `showRecentProfiles` | `false` | The five most recently launched profiles |
| `showTunnels` | `true` | Port forwarding panel and badges on the profiles |
| `showWorkspaces` | `true` | Workspace bar above the list |
| `showFilter` | `true` | Search field and its shortcut |
| `showSftp` | `true` | The SFTP tab of the sidebar and its panel |
| `showTransfers` | `true` | Transfer manager at the bottom of the sidebar |
| `showSnippets` | `true` | The *Snippets* entry of the right click and its tab |
| `showNotes` | `true` | The *note* entry of the right click and its badge |

Turning a block off also stops its background work — no tab scanning, no
latency probe, no transfer tracking for a panel nobody is looking at.

**Behaviour:**

| Setting | Default | Effect |
|---|---|---|
| `hideNativeTransfersMenu` | `true` | Hides Tabby's own transfers menu, which shows the same transfers |
| `workspaceSelectorMode` | `tabs` | Workspace bar as tabs, or as a dropdown list |
| `pingIntervalSeconds` | `0` | Latency probe interval; `0` disables it |
| `sftpAutoRefreshSeconds` | `0` | Re-reads the current folder on a cycle; `0` disables it |
| `sftpAutoReturnToProfiles` | `true` | Returns to the profile view when no SSH session is open any more |
| `sftpEditorPath` | *(empty)* | Program opened on double-click. Empty, Windows decides |
| `sftpDeleteDefaultButton` | `cancel` | Which button <kbd>Enter</kbd> activates in the SFTP delete confirmation |
| `sftpDragOutFolders` | `false` | Allows dragging a *folder* out to the OS, not just a file |
| `sftpColumns` | `size`, `date`, `mode` | Columns shown in the SFTP listing |
| `sftpFoldersFirst` | `true` | Sorts folders before files |
| `sftpShowHidden` | `true` | Shows dot-files |
| `sftpColumnBorders` | `true` | Column separators in the listing |
| `sftpZebra` | `true` | Alternating row background |

Your favourites, workspaces, snippets, notes, custom icons and orderings are
stored under the same key. They are data, not settings, and nothing here
deletes them.

</details>

## ⚠️ Known limitations

- **Remote editing has no locking.** The plugin checks that the remote file has
  not changed before sending your edit back, and refuses to overwrite if it
  has — but two people editing the same file at the same time is still last
  one wins.
- **Dragging out to a target that does not understand a deferred file offer**
  (Windows Terminal, MobaXterm) does nothing at all, silently. The source
  cannot detect it.
- **A profile shared through the clipboard keeps its host and port.** That is
  deliberate — it is what makes the folder useful — but it means the JSON
  describes your network. Use *Copy without credentials* when that matters.
- **Local shell profiles are never shared**: their options are a command to
  execute, which is precisely what should not arrive through a clipboard.

## 🛠️ Development

```bash
git clone https://github.com/TooMuhtsh/tabby-better-sidebar
cd tabby-better-sidebar
npm install --ignore-scripts   # avoids postinstall steps that build native code needlessly here
npm run watch
```

Then, with Tabby closed, link the folder into Tabby's plugin directory. Do not
use the `TABBY_PLUGINS` environment variable — it is broken on Windows:

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-sidebar" -Target "<path-to-this-folder>"
```

Restart Tabby completely after any rebuild — reloading the window is not enough,
since Tabby's plugin loader state is global to the process.

## Related

[**tabby-better-vault**](https://github.com/TooMuhtsh/tabby-better-vault) — the
sibling plugin, see [Better Tabby](#-better-tabby-the-plugin-family) above.

[**AI governance docs**](https://toomuhtsh.github.io/tabby-better-sidebar/.AIRules/README.html) —
this plugin is developed with an AI assistant under a written governance
charter, and the full working dossier is public: invariants and numbered
pitfalls, development journal, roadmap and a register of everything delivered,
browsable as a small static site.

## Credits

- [Tabby](https://github.com/Eugeny/tabby) by Eugeny — the terminal this plugin
  extends; its native profile sidebar is the starting point of this one
  (MIT, see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md))
- [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) — the
  service logo collection (Apache-2.0)
- [Iconify](https://iconify.design) Material Design Icons and Tabler, and
  [DOMPurify](https://github.com/cure53/DOMPurify)

## License

MIT — see [LICENSE](LICENSE).
