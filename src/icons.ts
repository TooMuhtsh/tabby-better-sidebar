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

/** Every "{prefix} fa-{name}" class string Tabby's own icon pickers offer, e.g. "fas fa-server". */
const faEntries: PickerIcon[] = Object.entries(faIconsData as Record<string, string[]>)
    .flatMap(([name, styles]) => styles.map(style => {
        const value = `${STYLE_PREFIX[style]} fa-${name}`
        return { name: value, value }
    }))

let entriesPromise: Promise<PickerIcon[]>|null = null

/**
 * The two Iconify collections are 5 MB of JSON — 97% of the built package —
 * for a picker most sessions never open. Imported dynamically so webpack emits
 * them as a separate chunk instead of inlining them in the bundle Tabby parses
 * at every startup; they still travel *inside* the package, which they must:
 * `@iconify-json/*` are devDependencies, absent from a user's install.
 *
 * The chunk is fetched, decoded and sorted once, on the first icon search, and
 * the promise itself is the cache — concurrent callers share one load rather
 * than racing to build the list twice.
 */
export function loadIconEntries (): Promise<PickerIcon[]> {
    entriesPromise ??= (async () => {
        const [mdi, tabler] = await Promise.all([
            import(/* webpackChunkName: "icon-sets" */ '@iconify-json/mdi/icons.json'),
            import(/* webpackChunkName: "icon-sets" */ '@iconify-json/tabler/icons.json'),
        ])
        // A JSON module reaches us as `{ default: … }` under webpack, but as
        // the object itself if anything ever loads this through plain CommonJS.
        const unwrap = (mod: any): IconifyIconSet => mod.default ?? mod
        return [
            ...faEntries,
            ...iconifyEntries(unwrap(mdi)),
            ...iconifyEntries(unwrap(tabler)),
        ].sort((a, b) => a.name.localeCompare(b.name))
    })()
    return entriesPromise
}
