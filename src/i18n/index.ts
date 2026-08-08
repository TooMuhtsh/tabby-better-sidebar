import { Inject, Injectable } from '@angular/core'
import { LocaleService, TranslateService } from 'tabby-core'

import fr_FR from './fr-FR'
import es_ES from './es-ES'
import de_DE from './de-DE'

/**
 * Plugin UI translations, grafted onto Tabby's own mechanism.
 *
 * Same design as tabby-better-vault's I18nService — the contract is
 * DUPLICATED between the Better plugins, like betterPanel.ts, never shared
 * through an npm import. The hard-won rules it encodes (all measured on the
 * vault, see its src/i18n/index.ts for the full rationale):
 *
 * - Tabby already mounts `TranslateService` (ngx-translate) and re-exports it
 *   from `tabby-core` — verified in the compiled bundle there. The
 *   `| translate` pipe reaches our templates through TabbyCoreModule, which
 *   src/index.ts already imports. No dependency to add.
 * - `@ngx-translate/core` is NOT a dependency of this project and must never
 *   become one: it is bundled INSIDE tabby-core and does not exist as a
 *   resolvable module at runtime — an external import would be a dead
 *   `require` (the vault's #V8 family, inverted).
 * - THE ENGLISH SOURCE STRING IS THE KEY. Tabby's missing-translation
 *   handler compiles the key itself when no translation exists, so every UI
 *   string in this plugin's code is written in English and the tables below
 *   translate it. A user in an uncovered locale sees English, never French.
 */

/**
 * Covered languages, by Tabby locale code — the same three the vault ships.
 *
 * Locale codes, not language codes: Tabby tells `en-US` from `en-GB`; an
 * entry under `fr` would never be found. `en-US` is deliberately absent —
 * our source strings ARE the English; registering an identity table would
 * make the locale exist in `translate.langs`, which is exactly what the
 * `merge()` comment below explains must not happen.
 */
const TABLES: Record<string, Record<string, string>> = {
    'fr-FR': fr_FR,
    'es-ES': es_ES,
    'de-DE': de_DE,
}

/**
 * What this plugin uses of `TranslateService`, declared here for lack of
 * types: tabby-core re-exports the class from `@ngx-translate/core`, which is
 * not installed here, and `skipLibCheck` silently degenerates the type to
 * `any` (measured on the vault). This interface gives the three members we
 * use their checking back — notably `setTranslation()`'s third argument,
 * whose omission would ERASE all of Tabby's own translations.
 */
interface TranslateApi {
    langs: string[]
    setTranslation (lang: string, translations: Record<string, string>, shouldMerge?: boolean): void
    instant (key: string, params?: Record<string, any>): string
}

@Injectable({ providedIn: 'root' })
export class SidebarPlusI18nService {
    constructor (
        @Inject(TranslateService) private translate: TranslateApi,
        private locale: LocaleService,
    ) { }

    /**
     * Hooks the tables onto Tabby's locale lifecycle. Called from the
     * NgModule constructor — subscription only, nothing that can block the
     * startup path.
     */
    install (): void {
        this.locale.localeChanged$.subscribe((lang: string) => this.merge(lang))

        // `localeChanged$` is a Subject, not a BehaviorSubject: it does not
        // replay. If the locale was set before this service existed, nothing
        // would arrive until the next language change — hence this catch-up,
        // under the condition that makes it safe (see merge()).
        const current = this.locale.getLocale()
        if (this.translate.langs.includes(current)) {
            this.merge(current)
        }
    }

    /**
     * Adds our strings to Tabby's for this locale.
     *
     * The third argument is NOT optional despite its default: without `true`,
     * `setTranslation()` REPLACES the language's table and the whole app
     * falls back to English. And never call this for a locale Tabby has not
     * loaded yet: `setTranslation()` registers the locale in
     * `translate.langs`, and `LocaleService.setLocale()` only loads its .po
     * `if (!translate.langs.includes(lang))` — registering first would skip
     * Tabby's own translations for the session. Both measured on the vault.
     */
    private merge (lang: string): void {
        const table = TABLES[lang]
        if (!table) {
            return
        }
        try {
            this.translate.setTranslation(lang, table, true)
        } catch (e) {
            // A table that fails to load leaves English in place: degraded
            // but usable. Nothing here justifies breaking Tabby.
            console.warn(`[tabby-better-sidebar] could not register ${lang} translations`, e)
        }
    }

    /**
     * Translates in TypeScript code, where the `| translate` template pipe is
     * not available: toasts, confirm dialogs, composed labels. Interpolation
     * params use ngx-translate's `{{name}}` syntax in the source string.
     */
    t (source: string, params?: Record<string, any>): string {
        return this.translate.instant(source, params)
    }
}
