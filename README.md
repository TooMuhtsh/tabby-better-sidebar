# tabby-better-sidebar

Enhanced connection sidebar for [Tabby](https://tabby.sh), on top of the native profile tree:

- [x] Pinned favorites section
- [x] Live connection status per profile
- [x] Drag & drop reordering (profiles and folders, including moving a profile between folders and re-parenting a folder)
- [x] Right-click: rename-free folder/profile creation, deletion, custom icon picker
- [x] Custom icon picker — searches Font Awesome plus the [Iconify](https://iconify.design) Material Design Icons and Tabler sets (offline, no network calls), keeps your 5 most recently used icons, and supports importing a custom SVG (sanitized with [DOMPurify](https://github.com/cure53/DOMPurify))
- [ ] Direct SFTP access from the tree (docked, dual-pane, FileZilla-style — not a floating window)
- [ ] Workspaces (visibility filtering, e.g. personal/work/project)

## Development

```
npm install --ignore-scripts
npm run watch
```

Then, with Tabby closed, link this folder into Tabby's plugins directory
(on Windows, `TABBY_PLUGINS` is broken — see `tabby_sidebar_roadmap.md`):

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-sidebar" -Target "<path-to-this-folder>"
```

Then just launch Tabby normally. After any rebuild, fully restart the app
(not just a window reload) to pick up changes.

See `tabby_sidebar_roadmap.md` for detailed build status, known pitfalls, and
fragile points to re-check after a Tabby update.

## License

MIT — see [LICENSE](./LICENSE). Portions adapted from
[Eugeny/tabby](https://github.com/Eugeny/tabby) (MIT), and the icon picker
builds on [DOMPurify](https://github.com/cure53/DOMPurify) (Apache-2.0/MPL-2.0)
and Iconify's Material Design Icons (Apache-2.0) and Tabler Icons (MIT) sets —
see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
