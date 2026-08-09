import { sanitizeSvgIcon } from './svgSanitizer'

/**
 * Sanitising an `icon` string coming from untrusted JSON (a pasted folder or
 * workspace), shared between `groupShare.ts` and `workspaceShare.ts` rather
 * than duplicated between them — a duplicated check is one whose second copy
 * does not get fixed along with the first.
 *
 * `icon` can be either an Iconify class name or a raw custom SVG string
 * (anything starting with `<`) — same two shapes the picker itself produces
 * (`applyCustomSvg()`/`selectIconClass()` in sidebarTree.component.ts).
 *
 * Both callers feed this into the same `<profile-icon>`, which does a raw
 * `innerHTML = value` for a string starting with `<` (svgSanitizer.ts's own
 * docstring) — bypassing Angular's `DomSanitizer` entirely, which only ever
 * runs on template `[innerHTML]` bindings, never on this imperative DOM
 * assignment. An SVG coming in through either share path therefore gets
 * exactly the sanitisation the picker's own custom-SVG input gets, rather
 * than being trusted because it arrived via a paste instead of a text box.
 */

/** A plain icon class (e.g. an Iconify name) has no reason to run long — generous cap against clipboard garbage. */
export const MAX_ICON_CLASS_LENGTH = 200

export function sanitiseIcon (value: unknown): string|undefined {
    if (typeof value !== 'string') {
        return undefined
    }
    const text = value.trim()
    if (!text) {
        return undefined
    }
    if (text.startsWith('<')) {
        const result = sanitizeSvgIcon(text)
        return result.ok ? result.svg : undefined
    }
    return text.length <= MAX_ICON_CLASS_LENGTH ? text : undefined
}
