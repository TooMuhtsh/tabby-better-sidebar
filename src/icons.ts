// Extracted from tabby-core's src/icons.json (MIT, see THIRD-PARTY-NOTICES.md) —
// this file is never published in the tabby-core npm package, only present in
// Tabby's own monorepo/installed source, so it has to be embedded as a static
// asset here rather than imported at runtime.
import faIconsData from './icons.json'

/** Style codes as used by icons.json: 's' = solid, 'r' = regular, 'b' = brand. */
const STYLE_PREFIX: Record<string, string> = { s: 'fas', r: 'far', b: 'fab' }

/** One searchable icon: `name` is matched against the user's query, `value` is what gets stored as profile/group `icon`. */
export interface PickerIcon {
    name: string
    value: string
    /**
     * Extra lowercase search terms matched in addition to `name`, but never
     * shown anywhere (dashboard-icons' upstream aliases, e.g. "claude"/
     * "claude-ai" for the "anthropic" logo). `undefined` for every other
     * source — Font Awesome and Iconify names are the only term they offer.
     */
    searchTerms?: string[]
    /**
     * Alternate renderings of the very same logical icon — dashboard-icons'
     * `-light`/`-dark` palettes, occasionally alongside its own unsuffixed
     * "default" file (see src/dashboardIcons.PROVENANCE.md). `value` above
     * already holds the preferred one (`default` > `light` > `dark`) so a
     * plain click keeps working exactly like every other picker entry;
     * `variants` only adds the option to pick a *different* one instead.
     * `undefined`/single-entry when the icon has nothing else to offer —
     * every other source never sets this at all.
     */
    variants?: { key: 'default'|'light'|'dark', value: string }[]
}

interface DashboardIconEntry {
    aliases: string[]
    /** Keyed by variant, ordered default/light/dark by the vendoring script — at least one is always present. */
    variants: Partial<Record<'default'|'light'|'dark', string>>
}

interface IconifyIconSet {
    prefix: string
    width: number
    height: number
    icons: Record<string, { body: string, width?: number, height?: number }>
}

/**
 * Iconify (iconify.design) per-collection npm packages ship each icon's SVG
 * body pre-extracted, MIT/Apache-2.0 licensed, entirely offline (no live
 * lookup against iconify's site or any third party) — see
 * THIRD-PARTY-NOTICES.md. These are bundled data we control, not
 * user-supplied input, so unlike a pasted custom SVG (svgSanitizer.ts) they
 * are used as-is: sanitizing ~14k bundled icons through DOMPurify at
 * startup would be a real (multi-second) cost for no security benefit.
 */
function iconifyEntries (data: IconifyIconSet): PickerIcon[] {
    return Object.entries(data.icons).map(([name, icon]) => ({
        name: `${data.prefix}:${name}`,
        value: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width ?? data.width} ${icon.height ?? data.height}">${icon.body}</svg>`,
    }))
}

/**
 * dashboard-icons (homarr-labs/dashboard-icons, Apache-2.0, see
 * THIRD-PARTY-NOTICES.md) — logos of self-hosted services, vendored offline
 * by scripts/vendor-dashboard-icons.js into src/dashboardIcons.json (see the
 * generated src/dashboardIcons.PROVENANCE.md for the exact upstream commit,
 * cap applied and counts). Same "bundled data we control" reasoning as
 * iconifyEntries() above: no DOMPurify pass here, the vendoring script
 * already stripped scripts/comments/prologs once at generation time.
 */
function dashboardIconEntries (data: Record<string, DashboardIconEntry>): PickerIcon[] {
    return Object.entries(data).map(([name, entry]) => {
        const variantKeys = (['default', 'light', 'dark'] as const).filter(k => entry.variants[k])
        const variants = variantKeys.length > 1
            ? variantKeys.map(key => ({ key, value: entry.variants[key]! }))
            : undefined
        return {
            name: `dashboard:${name}`,
            value: entry.variants[variantKeys[0]]!,
            searchTerms: entry.aliases.length ? entry.aliases : undefined,
            variants,
        }
    })
}

/** Every "{prefix} fa-{name}" class string Tabby's own icon pickers offer, e.g. "fas fa-server". */
const faEntries: PickerIcon[] = Object.entries(faIconsData as Record<string, string[]>)
    .flatMap(([name, styles]) => styles.map(style => {
        const value = `${STYLE_PREFIX[style]} fa-${name}`
        return { name: value, value }
    }))

let entriesPromise: Promise<PickerIcon[]>|null = null

/**
 * The two Iconify collections are 5 MB of JSON, and dashboard-icons.json
 * another ~12 MB on top — together the vast majority of the built package —
 * for a picker most sessions never open. Imported dynamically so webpack
 * emits them as separate chunks instead of inlining them in the bundle Tabby
 * parses at every startup; they still travel *inside* the package, which they
 * must: `@iconify-json/*` are devDependencies, absent from a user's install,
 * and dashboard-icons has no npm package at all (vendored, see above).
 * dashboard-icons.json gets its own chunk rather than joining "icon-sets":
 * a user who only ever searches Font Awesome/MDI/Tabler names never pays for
 * it, and vice versa is not true the other way around — every entry ends up
 * in the same merged, sorted list regardless of which chunk it came from.
 *
 * The chunks are fetched, decoded and sorted once, on the first icon search,
 * and the promise itself is the cache — concurrent callers share one load
 * rather than racing to build the list twice.
 */
export function loadIconEntries (): Promise<PickerIcon[]> {
    entriesPromise ??= (async () => {
        const [mdi, tabler, dashboardIcons] = await Promise.all([
            import(/* webpackChunkName: "icon-sets" */ '@iconify-json/mdi/icons.json'),
            import(/* webpackChunkName: "icon-sets" */ '@iconify-json/tabler/icons.json'),
            import(/* webpackChunkName: "dashboard-icons" */ './dashboardIcons.json'),
        ])
        // A JSON module reaches us as `{ default: … }` under webpack, but as
        // the object itself if anything ever loads this through plain CommonJS.
        const unwrap = (mod: any): any => mod.default ?? mod
        return [
            ...faEntries,
            ...iconifyEntries(unwrap(mdi)),
            ...iconifyEntries(unwrap(tabler)),
            ...dashboardIconEntries(unwrap(dashboardIcons)),
        ].sort((a, b) => a.name.localeCompare(b.name))
    })()
    return entriesPromise
}
