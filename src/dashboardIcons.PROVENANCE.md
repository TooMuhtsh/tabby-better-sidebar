# Provenance — src/dashboardIcons.json

Vendored from [homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons),
licensed under the Apache License 2.0 (see `THIRD-PARTY-NOTICES.md`). This
JSON is a static, offline asset checked into the repository — no network
access happens at runtime, only at generation time by this script.

- **Upstream commit**: `d64ee64282b076fa15e150b32c6880172880dd00`
- **Generated**: 2026-08-09
- **Cap applied**: 50 KB per individual SVG file (before any
  grouping into variants) — files over the cap are dropped entirely, not
  truncated. They remain reachable through the plugin's own "Import from an
  SVG..." custom-icon field, just not pre-bundled.
- **Grouping**: by filename convention read straight off upstream's `svg/`
  directory (`<name>.svg` / `<name>-light.svg` / `<name>-dark.svg`), not off
  `metadata.json`'s own `colors` field — that field only covers a minority of
  the icons that actually have light/dark files on disk. `metadata.json` is
  only used for its per-icon `aliases` (search synonyms).

## Counts (this generation)

| | |
|---|---|
| Upstream `svg/` files | 3294 (40.7 MB raw) |
| Excluded — over the 50 KB cap | 80 (29.3 MB) |
| Excluded — non-standard SVG root after cleanup | 8 |
| Kept individual SVG files | 3206 |
| Logical icons in `dashboardIcons.json` | 2468 |
| — of which with more than one variant | 665 |
| `dashboardIcons.json` size | 11.97 MB (12552670 bytes) |

## Regenerating

```
node scripts/vendor-dashboard-icons.js
```

Shallow-clones upstream's current `main` into a temporary directory, rebuilds
`src/dashboardIcons.json` from scratch, rewrites this file with fresh counts
and commit hash, then deletes the temporary clone. The counts above will
drift as upstream adds/removes icons — that is expected, this file only ever
describes the *last* generation, not a target to preserve.
