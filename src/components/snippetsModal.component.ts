import './snippetsModal.component.scss'
import { Component, Input, OnInit } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { PartialProfile, PartialProfileGroup, Profile, ProfileGroup } from 'tabby-core'
import { SidebarSnippet } from '../configProvider'
import { SidebarPlusSnippetsService, SnippetVariableRow } from '../snippets.service'

/** What the caller is asked to do once the modal closes — it owns the sessions and the settings tab, this does not. */
export type SnippetsModalResult =
    | { action: 'run', snippet: SidebarSnippet }
    | { action: 'library' }

/**
 * Everything a profile or folder says about snippets, in one centred modal.
 *
 * A modal rather than the popup this started as, at the user's request and for
 * the reason they gave: a 300px box anchored to the cursor is a poor place to
 * read commands and fill in a form. The context menu keeps one entry that opens
 * this.
 *
 * It deliberately runs nothing itself. Writing into a session means finding the
 * tab, focusing it and expanding the command — all of which the tree component
 * already does — so the chosen snippet is handed back through the modal result
 * and the caller acts on it. Closing on run is the right behaviour anyway: the
 * command lands at a prompt the user then has to look at.
 */
@Component({
    selector: 'sidebar-plus-snippets-modal',
    template: require('./snippetsModal.component.pug'),
})
export class SnippetsModalComponent implements OnInit {
    /** The profile the modal was opened on, or null when it was a folder. */
    @Input() profile: PartialProfile<Profile>|null = null
    @Input() group: PartialProfileGroup<ProfileGroup>|null = null

    chain: string[] = []
    ownerId = ''
    ownerName = ''
    /** Only a profile has a session to write into; on a folder this is a definition screen. */
    canRun = false

    constructor (
        private snippets: SidebarPlusSnippetsService,
        private modalInstance: NgbActiveModal,
    ) { }

    ngOnInit (): void {
        this.chain = this.profile
            ? this.snippets.chainForProfile(this.profile)
            : this.snippets.groupChain(this.group?.id)
        this.ownerId = this.chain[0] ?? ''
        this.ownerName = this.profile?.name ?? this.group?.name ?? ''
        this.canRun = !!this.profile
    }

    ////// LISTS //////
    get ownSnippets (): SidebarSnippet[] {
        return this.ownerId ? this.snippets.attachedSnippets(this.ownerId) : []
    }

    /**
     * Snippets from the folders above, with the folder each is attached to and
     * whether it is switched off here.
     *
     * Anything already attached to this very item is filtered out: attached to
     * both, a snippet used to be listed twice, once as its own and once as
     * inherited. Detaching is offered where the attachment is, never here —
     * from a profile it would take the snippet from every other profile of that
     * folder — which is exactly what muting is for.
     */
    get inheritedSnippets (): { source: string, snippet: SidebarSnippet, muted: boolean }[] {
        const own = new Set(this.ownSnippets.map(s => s.id))
        const seen = new Set<string>()
        return this.chain.slice(1).flatMap(id => this.snippets.attachedSnippets(id)
            .filter(snippet => {
                if (own.has(snippet.id) || seen.has(snippet.id)) {
                    return false
                }
                seen.add(snippet.id)
                return true
            })
            .map(snippet => ({
                source: this.snippets.groupName(id),
                snippet,
                muted: this.snippets.isMuted(this.ownerId, snippet),
            })))
    }

    /** Switches an inherited snippet off here, or back on — the folder keeps it either way. */
    async toggleMuted (snippet: SidebarSnippet): Promise<void> {
        await this.snippets.toggleMuted(this.ownerId, snippet)
    }

    /** Library snippets not already offered here — anything inherited is excluded, it would show twice. */
    get attachable (): SidebarSnippet[] {
        const shown = new Set([
            ...this.ownSnippets.map(s => s.id),
            ...this.inheritedSnippets.map(e => e.snippet.id),
        ])
        return this.snippets.library.filter(s => !shown.has(s.id))
    }

    /** The placeholders one snippet reads, with what answers them here. */
    variablesOf (snippet: SidebarSnippet): SnippetVariableRow[] {
        return this.snippets.variableRows(snippet, this.chain, this.profile)
    }

    /**
     * How many required variables this snippet still has no answer for.
     *
     * Shown as a badge on the folded button: the panel holds what has to be
     * filled in, so something has to say it needs opening. Zero renders
     * nothing.
     */
    missingCount (snippet: SidebarSnippet): number {
        return this.snippets.missingFor(snippet, this.chain, this.profile).length
    }

    async setVariable (snippet: SidebarSnippet, name: string, value: string): Promise<void> {
        // Empty means "no answer here" — the row falls back to what it
        // inherits, which is not the same as answering with an empty string.
        await this.snippets.writeVariable(this.ownerId, snippet.id, name, value.trim() ? value : null)
    }

    /** Keeps the rows' DOM across change detection — without it the `<input>` being typed into is rebuilt and loses focus. */
    trackByName (_index: number, row: { name: string }): string {
        return row.name
    }

    trackById (_index: number, row: SidebarSnippet): string {
        return row.id
    }

    trackByInherited (_index: number, row: { snippet: SidebarSnippet }): string {
        return row.snippet.id
    }

    ////// ACTIONS //////
    run (snippet: SidebarSnippet, muted = false): void {
        if (!this.canRun || muted) {
            return
        }
        this.modalInstance.close({ action: 'run', snippet } as SnippetsModalResult)
    }

    openLibrary (): void {
        this.modalInstance.close({ action: 'library' } as SnippetsModalResult)
    }

    async attach (snippet: SidebarSnippet): Promise<void> {
        await this.snippets.attach(this.ownerId, snippet)
    }

    async detach (snippet: SidebarSnippet): Promise<void> {
        await this.snippets.detach(this.ownerId, snippet)
    }


    ////// PER-SNIPPET BEHAVIOUR //////
    /** Which snippet's own settings are unfolded, if any — one at a time keeps the modal readable. */
    tuning: string|null = null

    toggleTuning (snippet: SidebarSnippet): void {
        this.tuning = this.tuning === snippet.id ? null : snippet.id
    }

    /** This snippet's answer *on this item*, `inherit` when it follows what the item says for all of them. */
    override (snippetId: string, key: 'autoLaunch'|'execute'): 'inherit'|'yes'|'no' {
        const value = this.snippets.overrideOf(this.ownerId, snippetId)[key]
        if (value === undefined) {
            return 'inherit'
        }
        return value ? 'yes' : 'no'
    }

    async setOverride (snippetId: string, key: 'autoLaunch'|'execute', choice: string): Promise<void> {
        await this.snippets.writeOverride(this.ownerId, snippetId, key, choice === 'inherit' ? undefined : choice === 'yes')
    }

    /** What "Suivre" resolves to for this snippet — the item's own answer, then its folders. */
    resolvedFor (snippetId: string, key: 'autoLaunch'|'execute'): boolean {
        return this.snippets.resolveSetting(key, this.chain, snippetId)
    }

    overrideDelay (snippetId: string): string {
        const value = this.snippets.overrideOf(this.ownerId, snippetId).launchDelayMs
        return value === undefined ? '' : String(value)
    }

    async setOverrideDelay (snippetId: string, raw: string): Promise<void> {
        const trimmed = raw.trim()
        const value = trimmed ? Math.min(60000, Math.max(0, Math.round(Number(trimmed) || 0))) : undefined
        await this.snippets.writeOverride(this.ownerId, snippetId, 'launchDelayMs', value)
    }

    /** Whether this snippet can open a session here — decides if its wait is worth showing. */
    launchesFor (snippetId: string): boolean {
        return this.resolvedFor(snippetId, 'autoLaunch')
    }

    ////// ITEM-WIDE BEHAVIOUR //////
    setting (key: 'autoLaunch'|'execute'): 'inherit'|'yes'|'no' {
        const value = this.snippets.settingsOf(this.ownerId)[key]
        if (value === undefined) {
            return 'inherit'
        }
        return value ? 'yes' : 'no'
    }

    /** What "Hériter" resolves to right now, spelled out in the option so the choice is never blind. */
    inherited (key: 'autoLaunch'|'execute'): boolean {
        return this.snippets.resolveSetting(key, this.chain.slice(1))
    }

    async setSetting (key: 'autoLaunch'|'execute', choice: string): Promise<void> {
        await this.snippets.writeSetting(this.ownerId, key, choice === 'inherit' ? undefined : choice === 'yes')
    }

    get autoLaunchOn (): boolean {
        const own = this.setting('autoLaunch')
        return own === 'yes' || (own === 'inherit' && this.inherited('autoLaunch'))
    }

    get delay (): string {
        const value = this.snippets.settingsOf(this.ownerId).launchDelayMs
        return value === undefined ? '' : String(value)
    }

    get inheritedDelay (): number {
        return this.snippets.resolveDelay(this.chain.slice(1))
    }

    async setDelay (raw: string): Promise<void> {
        const trimmed = raw.trim()
        // Clamped like the other durations of this plugin: whole units, never
        // negative, and a ceiling so a stray keystroke cannot park a snippet
        // behind a ten-minute wait with nothing saying why.
        const value = trimmed ? Math.min(60000, Math.max(0, Math.round(Number(trimmed) || 0))) : undefined
        await this.snippets.writeSetting(this.ownerId, 'launchDelayMs', value)
    }

    close (): void {
        this.modalInstance.dismiss()
    }
}
