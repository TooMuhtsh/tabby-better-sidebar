# tabby-better-sidebar

Enhanced connection sidebar for [Tabby](https://tabby.sh), on top of the native profile tree:

- [ ] Direct SFTP access from the tree (docked, dual-pane, FileZilla-style — not a floating window)
- [ ] Live connection status per profile
- [ ] Pinned favorites section
- [ ] Drag & drop reordering

## Status

Early scaffold. The tree view currently mirrors Tabby's built-in profile sidebar
(same data, same look) as a base to build on — none of the checklist above is
implemented yet.

## Development

```
npm install
npm run watch
```

Then, with Tabby closed, link this folder into Tabby's plugins directory
(on Windows, `TABBY_PLUGINS` is broken — see `tabby_sidebar_roadmap.md`):

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-sidebar" -Target "<path-to-this-folder>"
```

Then just launch Tabby normally. After any rebuild, fully restart the app
(not just a window reload) to pick up changes.

## License

MIT — see [LICENSE](./LICENSE). Portions adapted from
[Eugeny/tabby](https://github.com/Eugeny/tabby) (MIT) — see
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
