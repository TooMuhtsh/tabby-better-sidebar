/**
 * `@electron/remote`, or null when it cannot be reached.
 *
 * Loaded through the global `require` rather than an `import`: webpack would
 * otherwise try to resolve it at build time, and declaring it as an external
 * would hoist the require to module load — turning a missing module into a
 * plugin that fails to load at all, instead of one feature falling back.
 *
 * It resolves from a third-party plugin because Tabby's loader puts
 * `app.asar/node_modules` on NODE_PATH (`initModuleLookup()`, verified in the
 * compiled app), but it is *not* one of the modules Tabby caches for plugins —
 * see .AIRules/AI-CONTEXT.html, piège #44.
 */
export function electronRemote (): any|null {
    try {
        const req = (window as any).require ?? (global as any).require
        return req?.('@electron/remote') ?? null
    } catch {
        return null
    }
}
