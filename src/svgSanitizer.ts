import DOMPurify from 'dompurify'
import { TranslatableMessage } from './i18nMessage'

const ALLOWED_TAGS = ['svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect']
const ALLOWED_ATTR = [
    'viewBox', 'width', 'height', 'xmlns',
    'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points',
    'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity',
]
const MAX_LENGTH = 20_000

export interface SvgSanitizeResult {
    ok: boolean
    svg?: string
    /**
     * Message key and params, not a shown string — this module has no
     * injector access. Translated at the point of display in
     * `sidebarTree.component.ts`.
     */
    warning?: TranslatableMessage
    error?: TranslatableMessage
}

/**
 * Sanitizer for user-imported custom SVG icons.
 *
 * Tabby's own `<profile-icon>` renders any icon string starting with `<` via
 * `FastHtmlBindDirective`, which does a raw `element.innerHTML = value` in
 * TypeScript — this bypasses Angular's DomSanitizer entirely (that only ever
 * runs on template `[innerHTML]` bindings, not on an imperative DOM
 * assignment), and nothing sanitizes upstream (see roadmap item 2 / piège
 * #13). So this plugin never stores or displays a user-supplied SVG string
 * as-is. Uses DOMPurify (Cure53, MIT/Apache-2.0, widely audited) rather than
 * a hand-rolled parser — writing our own XSS sanitizer is exactly the kind
 * of security-critical code better delegated to a maintained, reviewed
 * library. `USE_PROFILES: {svg: true}` makes DOMPurify parse/serialize in
 * SVG (case-sensitive, e.g. `viewBox`) rather than HTML mode; the explicit
 * ALLOWED_TAGS/ALLOWED_ATTR then restrict DOMPurify's already-broad SVG
 * profile down to plain icon shapes only.
 */
export function sanitizeSvgIcon(raw: string): SvgSanitizeResult {
    const text = raw.trim()
    if (!text) {
        return { ok: false, error: { message: 'The SVG is empty.' } }
    }
    if (text.length > MAX_LENGTH) {
        return { ok: false, error: { message: 'SVG too large (limit: {limit} characters).', params: { limit: MAX_LENGTH } } }
    }

    const clean = DOMPurify.sanitize(text, { USE_PROFILES: { svg: true }, ALLOWED_TAGS, ALLOWED_ATTR }).trim()
    const removedCount = DOMPurify.removed.length

    if (!clean) {
        return { ok: false, error: { message: 'Invalid SVG, or entirely rejected by sanitisation.' } }
    }

    // DOMPurify.sanitize() returns a serialized fragment, not a validated
    // single-root document — re-parsing as real XML both confirms there is
    // exactly one root element and that it's an <svg> (a fragment with two
    // sibling roots, e.g. an injected second <svg>, fails XML parsing here).
    const doc = new DOMParser().parseFromString(clean, 'image/svg+xml')
    if (doc.querySelector('parsererror') || doc.documentElement?.tagName.toLowerCase() !== 'svg') {
        return { ok: false, error: { message: 'The root must be a single <svg> tag.' } }
    }

    return {
        ok: true,
        svg: clean,
        warning: removedCount > 0 ? { message: '{count} disallowed element(s) or attribute(s) removed.', params: { count: removedCount } } : undefined,
    }
}
