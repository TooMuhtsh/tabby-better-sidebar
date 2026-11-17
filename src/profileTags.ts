/**
 * Tags on profiles. Short labels shown as pills after the name, found by the
 * search, carried by duplication and by folder sharing.
 *
 * Kept out of the tree component like `groupShare.ts`, and for the same
 * reason. Parsing, cleaning and colouring are pure functions over plain
 * values, and the component is already over 5000 lines.
 *
 * Taken from the miller806 fork (commits b1bc527, e19cbd9 and 9b9681e), then
 * adapted. The fork recomputed the list and the colour of every pill from the template,
 * on every change detection pass, which is piège #54. Here `buildTagPills()`
 * runs once per config change and the template only reads a Map. The fork's
 * fixed pastel colour also vanished on light themes, so the hue alone comes
 * from here and the stylesheet mixes it with the row's own text colour.
 * The hue is picked from a short palette (`TAG_HUES`), not from the whole
 * wheel: two tags may share a colour, but two colours are never almost the
 * same.
 */

/** One pill as the tree renders it, computed ahead of time. */
export interface TagPill {
    text: string
    /** One of `TAG_HUES`, handed to the stylesheet as `--sidebar-plus-tag-hue` (an oklch hue). */
    hue: number
}

/** A label longer than this is cut. A pill is a reminder, not a note. */
const MAX_TAG_LENGTH = 40

/** Beyond this, a profile has a list rather than tags, and the rest is dropped. */
const MAX_TAGS_PER_PROFILE = 20

/**
 * The tags a list really holds, in order: trimmed, cut to length, without
 * empty entries and without duplicates.
 *
 * Duplicates are compared without case, and the first spelling wins. "Prod"
 * and "prod" side by side would look like a typo, and the search does not
 * tell them apart either.
 *
 * Takes `unknown` because it also cleans what a pasted folder carries, which
 * is text off the clipboard and has to be checked before it reaches the config.
 */
export function cleanTags (raw: unknown): string[] {
    if (!Array.isArray(raw)) {
        return []
    }
    const seen = new Set<string>()
    const out: string[] = []
    for (const entry of raw) {
        if (typeof entry !== 'string') {
            continue
        }
        const tag = entry.trim().slice(0, MAX_TAG_LENGTH).trim()
        const key = tag.toLowerCase()
        if (!tag || seen.has(key)) {
            continue
        }
        seen.add(key)
        out.push(tag)
        if (out.length >= MAX_TAGS_PER_PROFILE) {
            break
        }
    }
    return out
}

/**
 * What the user typed in the tags modal, as a clean list.
 *
 * Splits on the ASCII comma, the full width comma that a Chinese input method
 * types, and line breaks, so a list pasted one per line works too.
 */
export function parseTagsInput (text: string): string[] {
    return cleanTags(text.split(/[,，\r\n]+/))
}

/**
 * The tag colours, as oklch hues: red, orange, yellow, green, teal, blue,
 * violet and pink. Eight hues spread so that each one reads as its own colour
 * at the stylesheet's lightness. The continuous wheel used first gave whole
 * families of near twins (three close blues for "ovh", "test" and "app").
 */
export const TAG_HUES: readonly number[] = [25, 65, 100, 145, 190, 250, 295, 340]

/**
 * A stable colour for a label: the same text always gets the same one, on
 * every machine and after every restart. Case is ignored, like everywhere else
 * tags are compared.
 *
 * The string hash is the fork's. With eight colours, two tags can share one;
 * that is the price of colours that never look almost alike.
 */
export function tagHue (tag: string): number {
    let hash = 0
    for (const char of tag.toLowerCase()) {
        hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
    }
    return TAG_HUES[Math.abs(hash) % TAG_HUES.length]
}

/**
 * The pills of every profile, by profile id, ready for the template.
 *
 * An empty Map when tags are switched off: the rows then have nothing to
 * render, while `profileTags` itself stays untouched in the config.
 */
export function buildTagPills (profileTags: Record<string, unknown>|undefined, enabled: boolean): Map<string, TagPill[]> {
    const out = new Map<string, TagPill[]>()
    if (!enabled || !profileTags) {
        return out
    }
    for (const [id, list] of Object.entries(profileTags)) {
        const tags = cleanTags(list)
        if (tags.length) {
            out.set(id, tags.map(text => ({ text, hue: tagHue(text) })))
        }
    }
    return out
}
