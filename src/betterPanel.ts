import { Injector, Type } from '@angular/core'

/**
 * The unified "Better Tabby" settings tab, shared with the other "Better *"
 * plugins.
 *
 * Each plugin registers its contribution under a STRING token
 * (`BetterPanelContribution:<id>`) in its own module — never a class imported
 * from another plugin, so no plugin depends on another being installed. All
 * plugin modules land in the same root injector, so every contribution is
 * visible to every plugin regardless of load order. The plugin with the
 * lowest `hostWeight` hosts the tab and mounts the others as sub-sections;
 * everyone else withdraws its own tab (see settings.ts).
 *
 * Types and functions only in this file: it is imported by the module, the
 * provider and components alike, and importing a component from here would
 * close a cycle.
 */
export interface BetterPanelContribution {
    /** Stable identifier ('sidebar', 'vault', …) — ties, and the section anchors, hang off it. */
    id: string
    /** What the host shows on this contribution's sub-tab. */
    title: string
    /** Election key, lowest wins; ties broken by `id` alphabetically. sidebar = 10, vault = 20. */
    hostWeight: number
    /** The settings page to embed. The host mounts it through NgComponentOutlet. */
    componentType: Type<any>
}

/** This plugin's own contribution token. */
export const SIDEBAR_PANEL_TOKEN = 'BetterPanelContribution:sidebar'

/**
 * Every contribution token this plugin knows to look for. Hard-coded on
 * purpose: string tokens cannot be enumerated from an injector, so a future
 * "Better X" plugin must be added here (and in the other plugins' copies of
 * this list) to take part in the unified tab.
 */
export const KNOWN_PANEL_TOKENS = [
    SIDEBAR_PANEL_TOKEN,
    'BetterPanelContribution:vault',
]

/**
 * Provided (as `true`) by the host to the injector of an embedded settings
 * component, so that component can tell it is a sub-tab rather than a
 * full settings page — the vault uses it to drop its `content-box` class.
 */
export const BETTER_PANEL_EMBEDDED = 'BetterPanelEmbedded'

export const UNIFIED_TAB_ID = 'better-tabby'
export const UNIFIED_TAB_TITLE = 'Better Tabby'

export interface BetterPanelElection {
    /** Whether THIS plugin (the sidebar contribution) won the election. */
    isHost: boolean
    /** More than one contribution present — the tab is shared. */
    unified: boolean
    /** The other plugins' contributions, in election order. Empty when alone. */
    others: BetterPanelContribution[]
    /** The id of the settings tab that carries this plugin's page — what internal deep-links must target. */
    settingsTabId: string
}

/**
 * Resolves who hosts the shared settings tab. Deterministic for every caller:
 * the same sorted list comes out of every plugin's injector, so each one can
 * conclude alone whether it hosts, with no coordination beyond the tokens.
 */
export function electBetterPanelHost (injector: Injector): BetterPanelElection {
    const present = KNOWN_PANEL_TOKENS
        .map(token => injector.get<BetterPanelContribution|null>(token as any, null))
        .filter((c): c is BetterPanelContribution => !!c)
        .sort((a, b) => a.hostWeight - b.hostWeight || a.id.localeCompare(b.id))
    const mine = injector.get<BetterPanelContribution|null>(SIDEBAR_PANEL_TOKEN as any, null)
    const isHost = !!mine && present[0] === mine
    const unified = present.length > 1
    return {
        isHost,
        unified,
        others: present.filter(c => c !== mine),
        settingsTabId: unified ? UNIFIED_TAB_ID : 'better-sidebar',
    }
}
