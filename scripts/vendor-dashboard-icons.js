// Vendors homarr-labs/dashboard-icons (Apache-2.0, see THIRD-PARTY-NOTICES.md)
// into src/dashboardIcons.json — the icon picker's third source, alongside
// Font Awesome (src/icons.json) and the Iconify collections
// (@iconify-json/mdi, @iconify-json/tabler). No npm package exists for this
// set: it only lives as a GitHub repo, so this script shallow-clones it,
// reads its svg/ folder itself (not just metadata.json — see below), and
// writes a self-contained JSON asset that ships with the plugin. Re-run any
// time to refresh against the upstream repo's current `main`.
//
// FILENAME-CONVENTION GROUPING, NOT metadata.json's `colors` field: the
// upstream manifest maps light/dark variants for only ~600 of its ~3300 svg
// files, and misses real variant pairs that exist on disk (e.g. `atuin-light.svg`
// has no `atuin` metadata entry at all, and ~150 `*-wordmark-light/dark.svg`
// pairs aren't in metadata.json under any key). Grouping straight off the
// `svg/` directory listing by the `<name>` / `<name>-light` / `<name>-dark`
// filename convention is what upstream's own web picker does too, and it
// covers every file, not just the ones metadata.json happens to describe.
// metadata.json is still read, but only for its `aliases` (search synonyms).
//
// 50 KB CAP: measured 2026-08-08 on upstream's svg/, 3 295 files / 40.5 MB,
// median ~1.9 KB — 44 outlier files (bitmap smuggled inside <image> elements,
// up to ~4 MB) alone account for 26.7 MB. A flat per-file cap both drops
// those outliers and keeps the bundle a bounded, predictable size regardless
// of what upstream adds next. Excluded icons remain reachable through the
// plugin's existing "Import from an SVG..." custom-icon field — nothing is
// permanently lost, just not pre-bundled.
//
// NO DOMPurify PASS on the generated JSON at load time (src/icons.ts): same
// call as the bundled Iconify collections there — this is vendored data we
// control, fixed at a pinned upstream commit, not live user input. This
// script *does* strip a few things out of each raw file before bundling,
// which is a one-time build-time cleanup, not a runtime sanitization pass:
// XML prologs/DOCTYPEs/comments (editor cruft — Inkscape exports, mostly),
// and any `<script>` element (found empty/inert in 3 upstream files, likely
// browser-extension artifacts from how they were exported, but stripped on
// principle rather than trusted).

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const REPO_URL = 'https://github.com/homarr-labs/dashboard-icons.git'
const CAP_BYTES = 50 * 1024
const OUT_JSON = path.join(__dirname, '..', 'src', 'dashboardIcons.json')
const OUT_PROVENANCE = path.join(__dirname, '..', 'src', 'dashboardIcons.PROVENANCE.md')

/** Variant suffixes recognised in `svg/` filenames, in the order a tile prefers them as its default face. */
const VARIANT_ORDER = ['default', 'light', 'dark']
const VARIANT_SUFFIX_RE = /^(.+)-(light|dark)\.svg$/i

function log (msg) {
    console.log(`[vendor-dashboard-icons] ${msg}`)
}

function cleanSvg (raw) {
    let s = raw
    s = s.replace(/<\?xml[^>]*\?>/gi, '')
    s = s.replace(/<!DOCTYPE[^>]*>/gi, '')
    s = s.replace(/<!--[\s\S]*?-->/g, '')
    s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    s = s.replace(/<script\b[^>]*\/>/gi, '')
    // Upstream files are already single-line for the vast majority, but a
    // handful (Inkscape exports) are pretty-printed with indentation that
    // only bloats the bundle once every file is concatenated into one JSON.
    s = s.replace(/>\s+</g, '><')
    return s.trim()
}

// ---------------------------------------------------------------------------
// Isolation — three build-time rewrites, all forced by ONE fact: an icon is
// rendered by `element.innerHTML = value` (tabby-core's FastHtmlBindDirective,
// which <profile-icon> uses). That drops the markup straight into the live
// document, where it is neither a standalone file nor a shadow root:
//
//   1. host CSS reaches inside it and wins over its presentation attributes,
//   2. its `<style>` block becomes a GLOBAL stylesheet,
//   3. its internal `id`s land in the document's single id namespace.
//
// Each rewrite below closes one of those. All three are one-time
// transformations of vendored data, not a runtime sanitization pass (that
// distinction is the note at the top of this file).
// ---------------------------------------------------------------------------

/** A short, stable, CSS-safe token identifying one icon file. Deterministic: same input file, same token. */
function scopeToken (fileBase) {
    return `dbi-${fileBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

/**
 * (1) Pins the root `<svg>`'s own fill so host CSS cannot repaint the artwork.
 *
 * Tabby's theme carries `.list-group-item svg { fill: var(--bs-body-color);
 * fill-opacity: .75 }` (theme.new.scss) and appRoot has more of the same. CSS
 * beats presentation attributes, so on the ~85% of upstream files whose root
 * carries no fill of its own, every shape that relies on inheritance was
 * repainted the theme's foreground colour — a white silhouette instead of a
 * logo. An INLINE style is the fix: it outranks any non-`!important` rule.
 *
 * `#000` is not a choice of ours, it is the SVG initial value — this restores
 * exactly what the file draws in a standalone viewer, which is what its author
 * designed against, and is precisely why upstream ships `-light` variants for
 * dark backgrounds (offered per icon in the picker).
 *
 * Left alone when the root already declares a fill (its author made a call) or
 * uses `currentColor` (deliberately themeable — 17 files upstream).
 */
function pinRootFill (svg) {
    const openTag = svg.slice(0, svg.indexOf('>') + 1)
    if (/\sfill\s*=/.test(openTag) || /style\s*=\s*"[^"]*\bfill\s*:/.test(openTag)) {
        return svg
    }
    const pinned = 'fill:#000;fill-opacity:1'
    const withStyle = openTag.replace(/style\s*=\s*"([^"]*)"/, (_, decls) =>
        `style="${pinned};${decls}"`)
    const newTag = withStyle !== openTag
        ? withStyle
        : openTag.replace(/^<svg/i, `<svg style="${pinned}"`)
    return newTag + svg.slice(openTag.length)
}

/**
 * (2) Namespaces every internal `id`, and every reference to one.
 *
 * Measured upstream: 1 660 files carry ids, and short generic names dominate —
 * `id="a"` alone appears in 370 different files. The picker grid renders up to
 * 40 icons at once, so `url(#a)` (a gradient, clip path, mask, filter…)
 * resolved to whichever icon reached the document first: logos silently drawn
 * with a neighbour's gradient. Prefixing with the per-file token keeps every
 * reference intact while making it unambiguous.
 *
 * Longest ids first, so replacing `a` can never eat into `ab`.
 */
function namespaceIds (svg, token) {
    const ids = [...new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))]
        .sort((a, b) => b.length - a.length)
    let out = svg
    for (const id of ids) {
        const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const next = `${token}-${id}`
        out = out.replace(new RegExp(`(\\sid=")${esc}(")`, 'g'), `$1${next}$2`)
        out = out.replace(new RegExp(`url\\(\\s*#${esc}\\s*\\)`, 'g'), `url(#${next})`)
        out = out.replace(new RegExp(`((?:xlink:)?href=")#${esc}(")`, 'g'), `$1#${next}$2`)
        // `#id` used as a CSS selector inside the file's own <style> block.
        out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, block =>
            block.replace(new RegExp(`([\\s,{}])#${esc}\\b`, 'g'), `$1#${next}`))
    }
    return out
}

/**
 * Rewrites one CSS selector list so it can only ever match inside this icon.
 *
 * `.st0` must keep matching the root itself as well as its descendants, hence
 * the two forms; a bare `svg` means the root and nothing else.
 */
function scopeSelectorList (selectors, token) {
    return selectors.split(',').map(raw => {
        const sel = raw.trim()
        if (!sel) {
            return ''
        }
        if (/^svg$/i.test(sel)) {
            return `.${token}`
        }
        if (/^[.#[]/.test(sel) && !/[\s>+~]/.test(sel)) {
            return `.${token}${sel}, .${token} ${sel}`
        }
        return `.${token} ${sel}`
    }).filter(Boolean).join(',')
}

/**
 * (3) Confines the file's own `<style>` block to the file.
 *
 * 578 upstream files carry one, and injected via innerHTML each becomes a
 * document-wide stylesheet: `.st0` is declared by 165 different icons (so they
 * repaint each other), and some use bare `path`/`rect`/`svg`/`line` selectors,
 * which would restyle the whole of Tabby. Scoping every selector under the
 * icon's own token makes the block inert outside it.
 *
 * `@font-face` is dropped rather than scoped: it is not scopable, it would
 * register a document-wide family, and its `src` points at files that do not
 * travel with the icon anyway. `@keyframes` names are namespaced like ids, for
 * the same collision reason.
 */
function scopeStyleBlocks (svg, token) {
    return svg.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, css, close) => {
        let out = ''
        // Comments go first, before anything is parsed: a `/* … */` sitting in
        // front of a rule ends up inside the prelude, which both hides an
        // `@media` from the at-rule test below (the scope class would then be
        // glued in front of it, and an invalid at-rule takes its whole block
        // down with it) and makes the emitted selector needlessly odd.
        let rest = css.replace(/\/\*[\s\S]*?\*\//g, '')
        rest = rest.replace(/@font-face\s*\{[^}]*\}/gi, '')
        rest = rest.replace(/@keyframes\s+([\w-]+)/gi, (__, name) => `@keyframes ${token}-${name}`)
        rest = rest.replace(/(animation(?:-name)?\s*:\s*)([^;}]+)/gi, (full, prop, value) =>
            /\b(none|inherit|initial|unset)\b/i.test(value)
                ? full
                : prop + value.replace(/^\s*([\w-]+)/, (___, name) => `${token}-${name}`))
        // Walk rule by rule so an at-rule's braces are not mistaken for a
        // declaration block: @media wraps rules that each need scoping,
        // @keyframes wraps percentage steps that must be left alone.
        while (rest.length) {
            const brace = rest.indexOf('{')
            if (brace === -1) {
                break
            }
            const prelude = rest.slice(0, brace)
            const atRule = prelude.trim().startsWith('@')
            const body = readBlock(rest, brace)
            if (body === null) {
                break
            }
            if (atRule) {
                const keyframes = /^\s*@keyframes/i.test(prelude)
                out += prelude + '{' + (keyframes ? body.inner : scopeCss(body.inner, token)) + '}'
            } else {
                out += scopeSelectorList(prelude, token) + '{' + body.inner + '}'
            }
            rest = rest.slice(body.end + 1)
        }
        return open + out + close
    })
}

/** Scopes a bare list of rules (no at-rules expected inside `@media`, beyond nesting we do not meet here). */
function scopeCss (css, token) {
    let out = ''
    let rest = css
    while (rest.length) {
        const brace = rest.indexOf('{')
        if (brace === -1) {
            break
        }
        const body = readBlock(rest, brace)
        if (body === null) {
            break
        }
        out += scopeSelectorList(rest.slice(0, brace), token) + '{' + body.inner + '}'
        rest = rest.slice(body.end + 1)
    }
    return out
}

/** Reads a balanced `{...}` starting at `open`; returns its inner text and the index of the closing brace. */
function readBlock (text, open) {
    let depth = 0
    for (let i = open; i < text.length; i++) {
        if (text[i] === '{') {
            depth++
        } else if (text[i] === '}') {
            depth--
            if (depth === 0) {
                return { inner: text.slice(open + 1, i), end: i }
            }
        }
    }
    return null
}

/** The three rewrites above, in the order they must run (ids before styles: selectors carry ids too). */
function isolateSvg (svg, fileBase) {
    const token = scopeToken(fileBase)
    let out = namespaceIds(svg, token)
    const hasStyle = /<style\b/i.test(out)
    if (hasStyle) {
        out = scopeStyleBlocks(out, token)
        // The scope class has to exist on the root for the rules above to bite.
        out = /^<svg[^>]*\sclass="/i.test(out)
            ? out.replace(/^(<svg[^>]*\sclass=")/i, `$1${token} `)
            : out.replace(/^<svg/i, `<svg class="${token}"`)
    }
    return pinRootFill(out)
}

function main () {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-icons-vendor-'))
    log(`cloning ${REPO_URL} (depth 1) into ${tmpDir}...`)

    try {
        execFileSync('git', ['clone', '--depth', '1', REPO_URL, tmpDir], { stdio: 'inherit' })

        const commit = execFileSync('git', ['-C', tmpDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
        log(`cloned at commit ${commit}`)

        const svgDir = path.join(tmpDir, 'svg')
        const metadataPath = path.join(tmpDir, 'metadata.json')
        const metadata = fs.existsSync(metadataPath)
            ? JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
            : {}

        const allFiles = fs.readdirSync(svgDir).filter(f => f.toLowerCase().endsWith('.svg'))
        log(`${allFiles.length} .svg files in upstream svg/`)

        // Pass 1: read, cap, clean, validate — filename -> cleaned <svg>...</svg> markup.
        const kept = new Map()
        let excludedByCap = 0
        let excludedByCapBytes = 0
        let excludedMalformed = 0
        let totalRawBytes = 0

        for (const file of allFiles) {
            const fullPath = path.join(svgDir, file)
            const size = fs.statSync(fullPath).size
            totalRawBytes += size
            if (size > CAP_BYTES) {
                excludedByCap++
                excludedByCapBytes += size
                continue
            }
            const raw = fs.readFileSync(fullPath, 'utf8')
            const cleaned = cleanSvg(raw)
            if (!/^<svg[\s>]/i.test(cleaned)) {
                // A handful of upstream files use an Inkscape `<svg:svg ...>`
                // namespaced root, which an HTML parser's innerHTML (how
                // profile-icon renders a stored icon value) does not resolve
                // as the SVG element — it would silently fail to draw.
                excludedMalformed++
                continue
            }
            kept.set(file, isolateSvg(cleaned, file.replace(/\.svg$/i, '')))
        }

        // Pass 2: group kept files into logical icons by filename convention.
        const groups = new Map() // base name -> { default?, light?, dark? } (values: cleaned svg markup)
        for (const file of kept.keys()) {
            const m = file.match(VARIANT_SUFFIX_RE)
            if (!m) {
                continue
            }
            const [, base, variant] = m
            if (!groups.has(base)) {
                groups.set(base, {})
            }
            groups.get(base)[variant.toLowerCase()] = kept.get(file)
        }
        for (const file of kept.keys()) {
            if (VARIANT_SUFFIX_RE.test(file)) {
                continue
            }
            const base = file.replace(/\.svg$/i, '')
            if (!groups.has(base)) {
                groups.set(base, {})
            }
            groups.get(base).default = kept.get(file)
        }

        const data = {}
        let multiVariantCount = 0
        for (const [base, variants] of groups) {
            // Stable key order: default, light, dark — whichever are present.
            const orderedVariants = {}
            for (const key of VARIANT_ORDER) {
                if (variants[key]) {
                    orderedVariants[key] = variants[key]
                }
            }
            const aliases = (metadata[base]?.aliases ?? [])
                .map(a => String(a).toLowerCase())
                .filter(a => a && a !== base)
            data[base] = { aliases, variants: orderedVariants }
            if (Object.keys(orderedVariants).length > 1) {
                multiVariantCount++
            }
        }

        const json = JSON.stringify(data)
        fs.writeFileSync(OUT_JSON, json)

        const stats = {
            upstreamFiles: allFiles.length,
            upstreamRawMB: (totalRawBytes / 1024 / 1024).toFixed(1),
            excludedByCap,
            excludedByCapMB: (excludedByCapBytes / 1024 / 1024).toFixed(1),
            excludedMalformed,
            keptFiles: kept.size,
            logicalIcons: Object.keys(data).length,
            multiVariantIcons: multiVariantCount,
            jsonBytes: json.length,
            jsonMB: (json.length / 1024 / 1024).toFixed(2),
        }

        writeProvenance(commit, stats)

        log(`wrote ${OUT_JSON} (${stats.jsonMB} MB, ${stats.logicalIcons} icons, ${stats.multiVariantIcons} with more than one variant)`)
        log(`excluded: ${stats.excludedByCap} over ${CAP_BYTES / 1024} KB (${stats.excludedByCapMB} MB), ${stats.excludedMalformed} with a non-standard SVG root after cleanup`)
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
        log(`removed temporary clone ${tmpDir}`)
    }
}

function writeProvenance (commit, stats) {
    const date = new Date().toISOString().slice(0, 10)
    const content = `# Provenance — src/dashboardIcons.json

Vendored from [homarr-labs/dashboard-icons](${REPO_URL.replace(/\.git$/, '')}),
licensed under the Apache License 2.0 (see \`THIRD-PARTY-NOTICES.md\`). This
JSON is a static, offline asset checked into the repository — no network
access happens at runtime, only at generation time by this script.

- **Upstream commit**: \`${commit}\`
- **Generated**: ${date}
- **Cap applied**: ${CAP_BYTES / 1024} KB per individual SVG file (before any
  grouping into variants) — files over the cap are dropped entirely, not
  truncated. They remain reachable through the plugin's own "Import from an
  SVG..." custom-icon field, just not pre-bundled.
- **Grouping**: by filename convention read straight off upstream's \`svg/\`
  directory (\`<name>.svg\` / \`<name>-light.svg\` / \`<name>-dark.svg\`), not off
  \`metadata.json\`'s own \`colors\` field — that field only covers a minority of
  the icons that actually have light/dark files on disk. \`metadata.json\` is
  only used for its per-icon \`aliases\` (search synonyms).

## Counts (this generation)

| | |
|---|---|
| Upstream \`svg/\` files | ${stats.upstreamFiles} (${stats.upstreamRawMB} MB raw) |
| Excluded — over the ${CAP_BYTES / 1024} KB cap | ${stats.excludedByCap} (${stats.excludedByCapMB} MB) |
| Excluded — non-standard SVG root after cleanup | ${stats.excludedMalformed} |
| Kept individual SVG files | ${stats.keptFiles} |
| Logical icons in \`dashboardIcons.json\` | ${stats.logicalIcons} |
| — of which with more than one variant | ${stats.multiVariantIcons} |
| \`dashboardIcons.json\` size | ${stats.jsonMB} MB (${stats.jsonBytes} bytes) |

## Regenerating

\`\`\`
node scripts/vendor-dashboard-icons.js
\`\`\`

Shallow-clones upstream's current \`main\` into a temporary directory, rebuilds
\`src/dashboardIcons.json\` from scratch, rewrites this file with fresh counts
and commit hash, then deletes the temporary clone. The counts above will
drift as upstream adds/removes icons — that is expected, this file only ever
describes the *last* generation, not a target to preserve.
`
    fs.writeFileSync(OUT_PROVENANCE, content)
}

// Required as a module by scripts/check-dashboard-icons.js, which replays the
// isolation on the generated JSON to prove it holds; run directly, it vendors.
if (require.main === module) {
    main()
} else {
    module.exports = { isolateSvg, scopeToken, cleanSvg }
}
