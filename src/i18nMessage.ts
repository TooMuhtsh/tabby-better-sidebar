/**
 * A message key — the English source string that doubles as the i18n table
 * key (see `src/i18n/index.ts`) — paired with the ICU params it needs.
 *
 * `groupShare.ts`, `workspaceShare.ts` and `svgSanitizer.ts` are pure
 * modules with no injector access: they cannot call
 * `SidebarPlusI18nService.t()` themselves. Instead of a global singleton
 * reaching for one — which would be the one thing worth avoiding here — they
 * hand back a value shaped like this, and the component that already holds
 * `this.i18n` (found by grepping their callers) translates it at the point
 * of display.
 */
export interface TranslatableMessage {
    message: string
    params?: Record<string, unknown>
}
