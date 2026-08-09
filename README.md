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
management, and a full SFTP browser that lives in the sidebar's own space and
follows whichever SSH tab has focus.

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

## ✨ Sidebar

- **Pinned favorites**, for both profiles and folders
- **Live connection status** per profile, with an optional latency indicator
- **Active sessions** section, listing what is currently connected
- **Recent profiles** history (off by default)
- **Drag & drop** reordering — profiles and folders, including moving a profile
  between folders and re-parenting a folder
- **Workspaces**: hide profiles and folders per workspace (personal / work /
  project), each with its own favorites and its own sibling order, its own
  icon and an optional contextual colour; a tabs-or-dropdown selector, and
  one-click JSON export/import
- **Multiple selection**, for acting on several profiles at once
- **SSH tunnels** management from the tree
- **Right-click**: create and delete folders and profiles, clone a profile,
  attach snippets and notes, pick a custom icon
- **Custom icon picker** — searches Font Awesome plus the
  [Iconify](https://iconify.design) Material Design Icons and Tabler sets
  (offline, no network calls), keeps recently used icons at hand, lets you pin
  icons as favorites, and imports custom SVGs (sanitized with
  [DOMPurify](https://github.com/cure53/DOMPurify))

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
  has not changed in the meantime, and restoring its permissions afterwards
- **"Open with…"** stays available, but only from the context menu
- **Create, rename and delete** entries — `Delete` key included, with an HTML
  confirmation whose default button you choose in the settings
- **Drag a file out to the OS**: the download starts when you drop it, wherever
  you dropped it
- **Transfer manager** at the bottom of the sidebar — progress, speed, ETA and
  elapsed time per transfer, arrival check, cancel confirmation, visible from
  both views, hidden when empty
- **Optional auto-refresh** of the listing, off by default
- **Auto-return** to the profile view once no tab has an active SFTP session

## 🌍 Languages

The interface follows Tabby's language — English, plus French, Spanish and
German. Since 0.4.0 the whole sidebar is covered: profiles tree, context
menus, active sessions and tunnels, SFTP browser, dialogs, transfers and the
settings tab. Any other locale falls back to English.

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

<details>
<summary>From source (for development)</summary>

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

</details>

## AI governance docs

This plugin is developed with an AI assistant under a written governance
charter, and the full working dossier is public — browsable as a small static
site at
[**toomuhtsh.github.io/tabby-better-sidebar**](https://toomuhtsh.github.io/tabby-better-sidebar/.AIRules/README.html),
or straight from the [`.AIRules/`](./.AIRules/) folder: build status and
remaining work in [`ROADMAP.html`](./.AIRules/ROADMAP.html), a per-worksite
journal in [`AI-HISTORY.html`](./.AIRules/AI-HISTORY.html), and — most useful if
you intend to hack on this — [`AI-CONTEXT.html`](./.AIRules/AI-CONTEXT.html),
which collects every non-obvious Tabby, Angular and Windows pitfall met while
building it, along with the points to re-check after a Tabby update.

## License

MIT — see [LICENSE](./LICENSE). Portions adapted from
[Eugeny/tabby](https://github.com/Eugeny/tabby) (MIT), and the icon picker
builds on [DOMPurify](https://github.com/cure53/DOMPurify) (Apache-2.0/MPL-2.0)
and Iconify's Material Design Icons (Apache-2.0) and Tabler Icons (MIT) sets —
see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
