// The tab strip's styling, shared with the plugin's own settings page —
// imported by both so it is loaded whichever component shows first.
import './settingsNav.scss'
import { Component, HostBinding, Injector } from '@angular/core'

import { BETTER_PANEL_EMBEDDED, BetterPanelContribution, electBetterPanelHost } from '../betterPanel'

/**
 * The unified "Better Tabby" settings tab, when THIS plugin is elected host of
 * a family of more than one: one tab per plugin present, this plugin's own
 * contribution included. Never instantiated outside that case — settings.ts
 * returns the plain settings page when the plugin is alone.
 */
@Component({
    template: require('./hostPanel.component.pug'),
})
export class SidebarPlusHostPanelComponent {
    /** Tabby's root-tab convention (padding + max width) — this component only ever IS a root tab. */
    @HostBinding('class.content-box') contentBox = true

    /** Every contribution present, in election order — the host first. */
    panels: BetterPanelContribution[]

    /** The plugin tab showing; the host's own on open. */
    selected: string

    /**
     * Injector handed to the mounted components: the BetterPanelEmbedded token
     * tells them they are a tab of the unified panel rather than a root page —
     * it is what makes them drop their own `content-box` class.
     */
    embedInjector: Injector

    constructor (injector: Injector) {
        this.panels = electBetterPanelHost(injector).present
        // A plugin's deep-link may have asked for its own tab just before
        // opening this panel — honoured and cleared here, so it cannot pin the
        // selection for every later visit. The host's own page otherwise.
        const asked = this.panels.find(p => p.openRequested)
        if (asked) {
            asked.openRequested = false
        }
        this.selected = asked?.id ?? this.panels[0]?.id ?? ''
        this.embedInjector = Injector.create({
            providers: [{ provide: BETTER_PANEL_EMBEDDED, useValue: true }],
            parent: injector,
        })
    }

    /** `href='#'` is what gives the tabs their focus behaviour; without this the page would jump to the top on every click. */
    select (id: string, event: Event): void {
        event.preventDefault()
        this.selected = id
    }
}
