import { Injectable, Injector } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'

import { SidebarPlusSettingsTabComponent } from './components/settingsTab.component'
import { electBetterPanelHost, UNIFIED_TAB_ID, UNIFIED_TAB_TITLE } from './betterPanel'

/** @hidden */
@Injectable()
export class SidebarPlusSettingsTabProvider extends SettingsTabProvider {
    id = 'better-sidebar'
    icon = 'list'
    title = 'Better Sidebar'

    /**
     * Same weight as `tabby-better-vault`'s own tab, deliberately: the tabs are
     * sorted by `a.weight - b.weight + a.title.localeCompare(b.title)` and every
     * native tab leaves `weight` at 0, so a weight of 2 clears the ±1 that
     * `localeCompare` can return and puts both plugins after them. Equal weights
     * then sort the two alphabetically — "Better Sidebar" lands right before
     * "Better Vault", which is where the user asked for it.
     */
    weight = 2

    private isBetterPanelHost: boolean

    /**
     * The "Better Tabby" election happens here because provider instances are
     * built at startup (SettingsHotkeyProvider walks them all for hotkey
     * labels), and by then every plugin's contribution is already in the root
     * injector — registration is declarative, so load order does not matter.
     */
    constructor (injector: Injector) {
        super()
        const election = electBetterPanelHost(injector)
        this.isBetterPanelHost = election.isHost
        if (election.isHost && election.unified) {
            this.id = UNIFIED_TAB_ID
            this.title = UNIFIED_TAB_TITLE
        }
    }

    /**
     * `null` when another plugin hosts the shared tab. That is the official
     * withdrawal mechanism: the constructor of SettingsTabComponent (bundle of
     * tabby-settings) filters providers with `!!x.getComponentType()`. Not done
     * with a conditional useFactory returning null instead — the multi-provider
     * list would then hold a null entry, and SettingsHotkeyProvider iterates ALL
     * providers without that filter, reading `provider.id`/`provider.title`,
     * which would crash on it.
     */
    getComponentType (): any {
        return this.isBetterPanelHost ? SidebarPlusSettingsTabComponent : null
    }
}
