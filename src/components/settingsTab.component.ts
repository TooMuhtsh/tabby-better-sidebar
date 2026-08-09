import './settingsTab.component.scss'
import './settingsNav.scss'
import { Component, HostBinding, Inject, NgZone, Optional } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService } from 'tabby-core'
import { ConfirmModalComponent } from './confirmModal.component'
import { BETTER_PANEL_EMBEDDED } from '../betterPanel'
import { SidebarSnippet } from '../configProvider'
import { SidebarPlusEditorService } from '../editorLauncher.service'
import { hostSupports } from '../hostCompat'
import { SidebarPlusI18nService } from '../i18n'
import { SidebarPlusSnippetsService } from '../snippets.service'

/**
 * The plugin's page in Tabby's settings.
 *
 * Two pages, split by *ownership* rather than by subject (user's rule): every
 * setting sits under the switch of the feature it belongs to, so switching that
 * feature off takes its options away with it. Only what governs the whole
 * plugin — or Tabby itself — stays on the general page.
 */
@Component({
    template: require('./settingsTab.component.pug'),
})
export class SidebarPlusSettingsTabComponent {
    /**
     * Tabby's own settings pages carry it — it is what gives the page its
     * padding and max width. Dropped when this page is mounted as a tab of the
     * unified "Better Tabby" panel (BetterPanelEmbedded token present): the
     * host carries the layout then.
     */
    @HostBinding('class.content-box') contentBox: boolean

    /**
     * The page to open on, set by whoever is about to open this tab and read
     * once here.
     *
     * Static because the component does not exist yet at that point: the
     * sidebar's "Gérer la bibliothèque…" asks Tabby for the settings tab, and
     * Angular builds this only once the tab is shown. Reset on read so it
     * cannot pin the page for every later visit.
     */
    static requestedSection: 'general'|'features'|'snippets'|null = null

    /** Which page of this tab is showing. Deliberately not persisted: a reading position, not a preference. */
    section: 'general'|'features'|'snippets' = 'general'

    editorPath: string

    /** The snippet open in the editor, `null` when the list is showing. A blank `id` means it is new. */
    draft: SidebarSnippet|null = null

    constructor (
        private editors: SidebarPlusEditorService,
        private config: ConfigService,
        private snippetsService: SidebarPlusSnippetsService,
        private ngbModal: NgbModal,
        private zone: NgZone,
        private i18n: SidebarPlusI18nService,
        @Optional() @Inject(BETTER_PANEL_EMBEDDED) embedded: unknown,
    ) {
        this.contentBox = !embedded
        this.editorPath = this.editors.editorPath
        if (SidebarPlusSettingsTabComponent.requestedSection) {
            this.section = SidebarPlusSettingsTabComponent.requestedSection
            SidebarPlusSettingsTabComponent.requestedSection = null
        }
    }

    /** `href='#'` is what gives the tabs their pointer and focus behaviour; without this the page would jump to the top on every click. */
    setSection (section: 'general'|'features'|'snippets', event: Event): void {
        event.preventDefault()
        this.section = section
    }

    ////// I18N LABELS //////
    // Every user-visible string of the template lives here, NEVER as an inline
    // literal in the pug: a straight apostrophe (or em dash) inside an inline
    // `| translate` expression breaks the JIT compiler at runtime, invisibly
    // to the webpack build — the lot-2 incident of 2026-08-08. Getters are
    // fine on this cold page (unlike sidebarTree, piège #54).
    get lblPageTitle (): string { return this.i18n.t('Enhanced connection sidebar') }
    get lblPageSubtitle (): string { return this.i18n.t('Every block below can be switched off; the sidebar itself can too.') }
    get lblGeneral (): string { return this.i18n.t('General') }
    get lblFeatures (): string { return this.i18n.t('Features') }
    get lblShowSidebar (): string { return this.i18n.t('Show the sidebar') }
    get lblShowSidebarHint (): string { return this.i18n.t('Removes the sidebar without uninstalling anything.') }
    get lblShowSidebarDesc (): string { return this.i18n.t('Untick to hide it; this page stays reachable.') }
    get lblHideTransfersMenu (): string { return this.i18n.t('Hide the Tabby transfers menu') }
    get lblHideTransfersMenuHint (): string { return this.i18n.t('Otherwise the native Tabby menu opens on every transfer.') }
    get lblHideTransfersMenuDesc (): string { return this.i18n.t('The sidebar panel already shows the same transfers.') }
    get lblFeaturesIntro (): string { return this.i18n.t('Each block switches on independently. Nothing is deleted by turning one off.') }
    get lblTunnels (): string { return this.i18n.t('Active tunnels') }
    get lblTunnelsHint (): string { return this.i18n.t('Mirrors the state of Tabby port forwarding.') }
    get lblTunnelsDesc (): string { return this.i18n.t('Port forwarding panel and badges on the profiles.') }
    get lblUnavailable (): string { return this.i18n.t('Unavailable on this version of Tabby. Your setting is kept.') }
    get lblWorkspaces (): string { return this.i18n.t('Workspaces') }
    get lblWorkspacesHint (): string { return this.i18n.t('"All" excludes nothing; the filter bar searches everywhere.') }
    get lblWorkspacesDesc (): string { return this.i18n.t('Workspace bar, above the list.') }
    get lblPresentation (): string { return this.i18n.t('Presentation') }
    get lblPresentationHint (): string { return this.i18n.t('Tabs or a compact list, as you prefer.') }
    get lblPresentationDesc (): string { return this.i18n.t('Changes how the workspace bar is displayed.') }
    get lblModeTabs (): string { return this.i18n.t('Tabs (wrap onto new lines)') }
    get lblModeDropdown (): string { return this.i18n.t('Dropdown list') }
    get lblFilterBar (): string { return this.i18n.t('Filter bar') }
    get lblFilterBarHint (): string { return this.i18n.t('Searches the name, description, host and username.') }
    get lblFilterBarDesc (): string { return this.i18n.t('Search field and shortcut') }
    get lblSnippetsHint (): string { return this.i18n.t('A library of commands attached to profiles and folders.') }
    get lblSnippetsDesc (): string { return this.i18n.t('The "Snippets" entry of the right click and its dedicated tab.') }
    get lblNotes (): string { return this.i18n.t('Notes') }
    get lblNotesHint (): string { return this.i18n.t('A free-form memo per profile or folder.') }
    get lblNotesDesc (): string { return this.i18n.t('The "note" entry of the right click and its badge.') }
    get lblRecentProfiles (): string { return this.i18n.t('Recent profiles') }
    get lblRecentProfilesHint (): string { return this.i18n.t('The 5 most recently launched profiles, all types together.') }
    get lblRecentProfilesDesc (): string { return this.i18n.t('A list shown under the active sessions.') }
    get lblActiveSessions (): string { return this.i18n.t('Active sessions') }
    get lblActiveSessionsHint (): string { return this.i18n.t('One row per pane, not per tab.') }
    get lblActiveSessionsDesc (): string { return this.i18n.t('Open SSH connections, at the top of the sidebar.') }
    get lblPing (): string { return this.i18n.t('Latency probe, in seconds') }
    get lblPingHint (): string { return this.i18n.t('A real SFTP round trip, not an ICMP ping.') }
    get lblPingDesc (): string { return this.i18n.t('Colors the dot of each session. 0 disables.') }
    get lblSftp (): string { return this.i18n.t('SFTP view') }
    get lblSftpHint (): string { return this.i18n.t('One SFTP channel per session actually browsed.') }
    get lblSftpDesc (): string { return this.i18n.t('The SFTP tab of the sidebar and its panel.') }
    get lblEditor (): string { return this.i18n.t('Remote file editor') }
    get lblEditorHint (): string { return this.i18n.t('The file is copied, edited, then sent back to the server.') }
    get lblEditorDesc (): string { return this.i18n.t('Program opened on double-click. Empty, Windows decides.') }
    get lblEditorPlaceholder (): string { return this.i18n.t('No editor chosen') }
    get lblBrowse (): string { return this.i18n.t('Browse...') }
    get lblClear (): string { return this.i18n.t('Erase') }
    get lblDragOut (): string { return this.i18n.t('Drag a folder out to Explorer') }
    get lblDragOutHint (): string { return this.i18n.t('The folder is downloaded in full before the drop.') }
    get lblDragOutDesc (): string { return this.i18n.t('Beyond 25 files or 20 MB, confirmation is asked.') }
    get lblAutoRefresh (): string { return this.i18n.t('Automatic refresh, in seconds') }
    get lblAutoRefreshHint (): string { return this.i18n.t('Only changed entries are redrawn.') }
    get lblAutoRefreshDesc (): string { return this.i18n.t('0 disables; every cycle re-reads the folder.') }
    get lblAutoReturn (): string { return this.i18n.t('Return to Profiles when no SSH session is open any more') }
    get lblAutoReturnHint (): string { return this.i18n.t('Also covers the waiting screen of the SFTP panel.') }
    get lblAutoReturnDesc (): string { return this.i18n.t('Waits for the grace period of the displayed session to end.') }
    get lblDeleteDefault (): string { return this.i18n.t('Deletion: button activated by Enter') }
    get lblDeleteDefaultHint (): string { return this.i18n.t('No deletion can be undone afterwards.') }
    get lblDeleteApplies (): string { return this.i18n.t('Applies to') }
    get lblDeleteRightClick (): string { return this.i18n.t('and to the right click.') }
    get lblDeleteEscape (): string { return this.i18n.t('always cancels.') }
    get lblKeyDel (): string { return this.i18n.t('Del') }
    get lblKeyEsc (): string { return this.i18n.t('Esc') }
    get lblOptionCancel (): string { return this.i18n.t('Cancel: the safe answer (default)') }
    get lblOptionConfirm (): string { return this.i18n.t('Delete: Del then Enter in one gesture') }
    get lblTransfers (): string { return this.i18n.t('Transfer manager') }
    get lblTransfersHint (): string { return this.i18n.t('Also mirrors the transfers of the native SFTP panel.') }
    get lblTransfersDesc (): string { return this.i18n.t('Panel shown at the bottom of the sidebar.') }
    get lblSnippetsIntro (): string { return this.i18n.t('A command written once, usable everywhere it is attached.') }
    get lblNoSnippets (): string { return this.i18n.t('No snippets yet.') }
    get lblUnusedSummary (): string { return this.i18n.t('{count} snippet(s) attached to nothing.', { count: this.unusedCount }) }
    get lblUnusedDetail (): string { return this.i18n.t('Detached from the sidebar, they stay here until deleted.') }
    get lblAttachedNowhere (): string { return this.i18n.t('attached nowhere') }
    get lblEdit (): string { return this.i18n.t('Modify') }
    get lblDelete (): string { return this.i18n.t('Delete') }
    get lblNewSnippet (): string { return this.i18n.t('New snippet') }
    get lblName (): string { return this.i18n.t('Name') }
    get lblNameDesc (): string { return this.i18n.t('What the context menu shows.') }
    get lblNamePlaceholder (): string { return this.i18n.t('Restart nginx') }
    get lblCommand (): string { return this.i18n.t('Command') }
    get lblCommandUse (): string { return this.i18n.t('Use') }
    get lblCommandRequired (): string { return this.i18n.t('for a required value, or') }
    get lblCommandDefault (): string { return this.i18n.t('for a default value.') }
    get lblSave (): string { return this.i18n.t('Save') }
    get lblCancel (): string { return this.i18n.t('Cancel') }
    get lblDraftWarning (): string {
        return this.i18n.t('Changes the command on the {count} existing attachment(s).', { count: this.draft ? this.attachmentCount(this.draft) : 0 })
    }

    /** The per-row "rattaché à N élément(s)" caption — a method because it needs the row's snippet. */
    attachedToLabel (snippet: SidebarSnippet): string {
        return this.i18n.t('attached to {count} item(s)', { count: this.attachmentCount(snippet) })
    }


    ////// SNIPPET LIBRARY //////
    get snippets (): SidebarSnippet[] {
        return this.snippetsService.library
    }

    /** What a deletion would take away, stated before it is done rather than discovered afterwards. */
    attachmentCount (snippet: SidebarSnippet): number {
        return this.snippetsService.attachmentCount(snippet)
    }

    /** The placeholders a command reads, listed under it so the library says what each will ask of a profile. */
    variablesOf (snippet: SidebarSnippet): { name: string, required: boolean }[] {
        return this.snippetsService.parse(snippet.command)
    }

    /**
     * Snippets attached nowhere.
     *
     * Each row already says so on its own; this is the count, and it only
     * shows up once there is something to clean. Detaching is the everyday
     * gesture and deleting is not, so the library fills up with experiments
     * that nothing points at any more — worth surfacing, not worth nagging
     * about.
     */
    get unusedCount (): number {
        return this.snippets.filter(s => !this.attachmentCount(s)).length
    }

    newSnippet (): void {
        this.draft = { id: '', name: '', command: '' }
    }

    editSnippet (snippet: SidebarSnippet): void {
        this.draft = { ...snippet }
    }

    cancelEdit (): void {
        this.draft = null
    }

    /** An edit changes the command everywhere it is attached — the page says so next to the button. */
    async saveDraft (): Promise<void> {
        if (!this.draft) {
            return
        }
        if (await this.snippetsService.save(this.draft)) {
            this.draft = null
        }
    }

    /**
     * Deletes the command outright, once confirmed.
     *
     * Confirmed and not undoable: the count of what it would take away is the
     * whole point of asking, and it is knowable *before* rather than after.
     * The plugin's own modal rather than a system dialog (piège #42), with the
     * cautious button focused — a reflex Entrée must not delete.
     */
    async deleteSnippet (snippet: SidebarSnippet): Promise<void> {
        const count = this.attachmentCount(snippet)
        const modal = this.ngbModal.open(ConfirmModalComponent)
        modal.componentInstance.message = count
            ? this.i18n.t('Delete the snippet "{name}"? It is attached to {count} item(s), which will lose it.', { name: snippet.name, count })
            : this.i18n.t('Delete the snippet "{name}"?', { name: snippet.name })
        modal.componentInstance.confirmLabel = this.i18n.t('Delete')
        if (!await modal.result.catch(() => false)) {
            return
        }
        await this.snippetsService.deleteFromLibrary(snippet)
        if (this.draft?.id === snippet.id) {
            this.draft = null
        }
    }

    get enabled (): boolean {
        return this.config.store.sidebarPlus?.enabled ?? true
    }

    async setEnabled (value: boolean): Promise<void> {
        this.config.store.sidebarPlus.enabled = value
        await this.config.save()
    }

    /**
     * Whether a block is on — its switch ticked *and* the host still able to
     * carry it.
     *
     * Both halves in one call because the template needs the conjunction
     * everywhere: it drives the toggle's state and the `*ngIf` on the options
     * the block owns. `requires` is the precondition id of hostCompat.ts, absent
     * for blocks that depend on nothing beyond the plugin itself.
     */
    blockOn (key: string, requires?: string): boolean {
        return (this.config.store.sidebarPlus?.[key] ?? true) && this.hostHas(requires)
    }

    /** Whether the host still provides a precondition. No id means nothing to require. */
    hostHas (id?: string): boolean {
        return !id || hostSupports(id)
    }

    /**
     * Stores the user's own answer, and only that.
     *
     * A block the host can no longer carry is shown unavailable with its switch
     * left as it was, never rewritten to false: that setting is the user's
     * choice, and overwriting it would lose it the day the host provides the
     * component again.
     */
    async setBlock (key: string, value: boolean): Promise<void> {
        this.config.store.sidebarPlus[key] = value
        // Nothing else to poke: the sidebar and the mount service both listen
        // to `config.changed$`, which is where the block is reconciled (an
        // active workspace dropped, a filter cleared, the SFTP view left).
        await this.config.save()
    }

    get workspaceSelectorMode (): string {
        return this.config.store.sidebarPlus?.workspaceSelectorMode ?? 'tabs'
    }

    async setWorkspaceSelectorMode (value: string): Promise<void> {
        this.config.store.sidebarPlus.workspaceSelectorMode = value
        await this.config.save()
    }

    get dragOutFolders (): boolean {
        return !!this.config.store.sidebarPlus?.sftpDragOutFolders
    }

    async setDragOutFolders (value: boolean): Promise<void> {
        this.config.store.sidebarPlus.sftpDragOutFolders = value
        await this.config.save()
    }

    get deleteDefaultButton (): string {
        return this.config.store.sidebarPlus?.sftpDeleteDefaultButton ?? 'cancel'
    }

    async setDeleteDefaultButton (value: string): Promise<void> {
        this.config.store.sidebarPlus.sftpDeleteDefaultButton = value
        await this.config.save()
    }

    get hideNativeTransfersMenu (): boolean {
        return this.config.store.sidebarPlus?.hideNativeTransfersMenu ?? true
    }

    /**
     * No repaint to force here: the class on `body` is applied by
     * SidebarPlusMountService, which is already listening to `config.changed$`.
     */
    async setHideNativeTransfersMenu (value: boolean): Promise<void> {
        this.config.store.sidebarPlus.hideNativeTransfersMenu = value
        await this.config.save()
    }

    get autoRefreshSeconds (): number {
        return Number(this.config.store.sidebarPlus?.sftpAutoRefreshSeconds ?? 0)
    }

    /** Clamped to whole seconds and never negative; 0 is the documented "off". */
    async setAutoRefreshSeconds (value: unknown): Promise<void> {
        const seconds = Math.max(0, Math.round(Number(value) || 0))
        this.config.store.sidebarPlus.sftpAutoRefreshSeconds = seconds
        await this.config.save()
    }

    get autoReturnToProfiles (): boolean {
        return this.config.store.sidebarPlus?.sftpAutoReturnToProfiles ?? true
    }

    async setAutoReturnToProfiles (value: boolean): Promise<void> {
        this.config.store.sidebarPlus.sftpAutoReturnToProfiles = value
        await this.config.save()
    }

    get pingIntervalSeconds (): number {
        return Number(this.config.store.sidebarPlus?.pingIntervalSeconds ?? 0)
    }

    /** Same clamping as the auto-refresh above: whole seconds, never negative, 0 being the documented "off". */
    async setPingIntervalSeconds (value: unknown): Promise<void> {
        const seconds = Math.max(0, Math.round(Number(value) || 0))
        this.config.store.sidebarPlus.pingIntervalSeconds = seconds
        await this.config.save()
    }

    async save (): Promise<void> {
        await this.editors.setEditorPath(this.editorPath.trim())
    }

    /**
     * `zone.run()` around the state change, not around the await: the picker
     * resolves outside Angular's zone, so assigning `editorPath` on the way
     * back updates the field without repainting it (piège #41).
     */
    async browse (): Promise<void> {
        const picked = await this.editors.pickEditorPath()
        if (!picked) {
            return
        }
        await this.editors.setEditorPath(picked)
        this.zone.run(() => {
            this.editorPath = picked
        })
    }

    async clear (): Promise<void> {
        this.editorPath = ''
        await this.editors.setEditorPath('')
    }

    get canOpenWith (): boolean {
        return this.editors.canOpenWith
    }
}
