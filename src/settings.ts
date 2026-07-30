import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'

import { SidebarPlusSettingsTabComponent } from './components/settingsTab.component'

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

    getComponentType (): any {
        return SidebarPlusSettingsTabComponent
    }
}
