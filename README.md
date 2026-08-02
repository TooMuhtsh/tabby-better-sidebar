# tabby-better-sidebar

Enhanced connection sidebar for [Tabby](https://tabby.sh), built on top of the
native profile tree — with a contextual SFTP browser living *inside* the sidebar
rather than in a separate docked panel.

## Sidebar

- **Pinned favorites**, for both profiles and folders
- **Live connection status** per profile
- **Active sessions** section, listing what is currently connected
- **Drag & drop** reordering — profiles and folders, including moving a profile
  between folders and re-parenting a folder
- **Workspaces**: hide profiles and folders per workspace (personal / work /
  project), each with its own favorites and its own sibling order
- **Multiple selection**, for acting on several profiles at once
- **SSH tunnels** management from the tree
- **Right-click**: create and delete folders and profiles, pick a custom icon
- **Custom icon picker** — searches Font Awesome plus the
  [Iconify](https://iconify.design) Material Design Icons and Tabler sets
  (offline, no network calls), keeps recently used icons at hand, lets you pin
  icons as favorites, and imports custom SVGs (sanitized with
  [DOMPurify](https://github.com/cure53/DOMPurify))

## SFTP

The browser replaces the profile tree in the sidebar's own space and follows
whichever SSH tab has focus — each tab remembers where it was.

- **Configurable columns** (size, date, octal and long permissions, type,
  extension), folders-first sorting, hidden files toggle, zebra striping
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
  elapsed time per transfer, visible from both views, hidden when empty
- **Optional auto-refresh** of the listing, off by default

## Elsewhere

- <kbd>Ctrl</kbd>+<kbd>Enter</kbd> inserts a line break in the terminal instead
  of submitting
- A dedicated settings tab under Tabby's own settings

## Installation

Install `tabby-better-sidebar` from Tabby's plugin manager, or with npm into
Tabby's plugin directory.

## Development

```
npm install --ignore-scripts   # avoids postinstall steps that build native code needlessly here
npm run watch
```

Then, with Tabby closed, link this folder into Tabby's plugins directory. Do not
use the `TABBY_PLUGINS` environment variable — it is broken on Windows:

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-sidebar" -Target "<path-to-this-folder>"
```

Then launch Tabby normally. After any rebuild, **fully restart the application**
— reloading the window is not enough, since Tabby's plugin loader state is
global to the process.

The [`.AIRules/`](./.AIRules/) folder holds this project's full documentation,
as static HTML pages you can open directly in a browser: build status and
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
