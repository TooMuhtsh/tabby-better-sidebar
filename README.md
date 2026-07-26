# tabby-sidebar-plus

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

Then, with Tabby closed, run it pointing at this plugin directory:

```
TABBY_PLUGINS=<path-to-this-folder> tabby --debug
```

## License

MIT — see [LICENSE](./LICENSE). Portions adapted from
[Eugeny/tabby](https://github.com/Eugeny/tabby) (MIT) — see
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
