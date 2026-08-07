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
            ? `Supprimer « ${snippet.name} » ? Il est rattaché à ${count} élément(s), qui le perdront.`
            : `Supprimer « ${snippet.name} » ?`
        modal.componentInstance.confirmLabel = 'Supprimer'
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
