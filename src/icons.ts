// Extracted from tabby-core's src/icons.json (MIT, see THIRD-PARTY-NOTICES.md) —
// this file is never published in the tabby-core npm package, only present in
// Tabby's own monorepo/installed source, so it has to be embedded as a static
// asset here rather than imported at runtime.
import faIconsData from './icons.json'
import mdiIconsData from '@iconify-json/mdi/icons.json'
import tablerIconsData from '@iconify-json/tabler/icons.json'

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

export const ICON_ENTRIES: PickerIcon[] = [
    ...faEntries,
    ...iconifyEntries(mdiIconsData as IconifyIconSet),
    ...iconifyEntries(tablerIconsData as IconifyIconSet),
].sort((a, b) => a.name.localeCompare(b.name))
