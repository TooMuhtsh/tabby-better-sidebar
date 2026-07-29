import './sidebarTree.component.scss'
import FuzzySearch from 'fuzzy-search'
import { merge, Subscription, timer } from 'rxjs'
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop'
import { AfterViewChecked, Component, HostBinding, HostListener, Inject, Input, OnDestroy, OnInit } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import {
    AppService,
    BaseTabComponent,
    ConfigService,
    NotificationsService,
    PartialProfile,
    PartialProfileGroup,
    Profile,
    ProfileGroup,
    ProfileProvider,
    ProfilesService,
    SplitTabComponent,
} from 'tabby-core'
import { EditProfileModalComponent, SettingsTabComponent } from 'tabby-settings'
import { ICON_ENTRIES, PickerIcon } from '../icons'
import { sanitizeSvgIcon } from '../svgSanitizer'
import { SidebarWorkspace } from '../configProvider'
import { clampInViewport } from '../viewport'

interface CollapsableProfileGroup extends ProfileGroup {
    collapsed: boolean
    children: PartialProfileGroup<CollapsableProfileGroup>[]
}

type ProfileConnectionStatus = 'connected' | 'error'

/** Duck-typed shape of tabs that carry a launching profile and a live session (e.g. BaseTerminalTabComponent). */
interface ProfileBackedTab {
    profile?: { id?: string }
    session?: unknown
}

@Component({
    selector: 'sidebar-plus-tree',
    template: require('./sidebarTree.component.pug'),
})
export class SidebarPlusTreeComponent implements OnInit, OnDestroy, AfterViewChecked {
    profileGroups: PartialProfileGroup<ProfileGroup>[] = []
    rootGroups: PartialProfileGroup<ProfileGroup>[] = []

    @Input() filter = ''

    ////// WORKSPACES //////
    workspaces: SidebarWorkspace[] = []
    // Per-machine UI state, not synced config: switching workspaces is not
    // something that should dirty config.yaml on every click.
    activeWorkspaceId = window.localStorage.sidebarPlusActiveWorkspace ?? 'all'
    contextMenuWorkspace: SidebarWorkspace|null = null
    newWorkspaceName = ''
    renameWorkspaceValue = ''
    /** Toggles the sidebar between the normal tree and the "hidden items of this workspace" panel — see hiddenGroupsInWorkspace/hiddenProfilesInWorkspace. */
    showHiddenPanel = false

    ////// SFTP //////
    /**
     * Swaps the whole sidebar between the profile tree and the SFTP view of
     * the focused SSH session. Deliberately a *global* toggle for this first
     * pass rather than one state per tab: the roadmap leaves the question open
     * ("bascule par onglet ou globale ?"), and a single mode is the version
     * that can be judged in use before committing to per-tab bookkeeping.
     *
     * Per-machine UI state, so localStorage like panelInternalWidth and
     * activeWorkspaceId — not a config.yaml key that would sync across
     * machines on every click.
     */
    sftpMode = window.localStorage.sidebarPlusSftpMode === 'true'

    /**
     * Groups (isTemplate/blacklist already filtered, like profileGroups) but
     * *not* filtered by the active workspace's visibility — kept around so
     * the "show hidden" panel can still render a name/icon for something the
     * main tree currently excludes. Refreshed by every successful
     * loadTreeItems() call.
     */
    private rawGroupsSnapshot: PartialProfileGroup<ProfileGroup>[] = []
    /** Monotonic counter guarding against overlapping loadTreeItems() calls (e.g. a config.changed$ reload racing an explicit workspace switch) — only the most recently *started* call's results are ever committed, see loadTreeItems(). */
    private loadTreeRequestId = 0

    panelMinWidth = 200
    panelMaxWidth = 600
    panelInternalWidth = parseInt(window.localStorage.sidebarPlusTreeWidth ?? '300')
    panelStartWidth = this.panelInternalWidth
    panelIsResizing = false
    panelStartX = 0

    profileStatuses = new Map<string, ProfileConnectionStatus>()
    private statusSubscription: Subscription|null = null
    private modalWatchInterval: ReturnType<typeof setInterval>|null = null

    contextMenuGroup: PartialProfileGroup<CollapsableProfileGroup>|null = null
    contextMenuProfile: PartialProfile<Profile>|null = null
    contextMenuRoot = false
    contextMenuX = 0
    contextMenuY = 0
    contextMenuMode:
        'menu'|'icon'|'createGroup'|'createProfile'|'confirmDeleteProfile'|'rename'|
        'workspaceMenu'|'createWorkspace'|'renameWorkspace'|'confirmDeleteWorkspace' = 'menu'
    /** Set whenever a context menu/popup opens or switches mode — checked once in ngAfterViewChecked() to clamp it back on-screen after Angular renders it at its real size. */
    private menuPositionDirty = false

    ////// ICON TILE CONTEXT MENU //////
    /** The icon a right-click opened the pin/unpin menu on, or null. Kept outside contextMenuMode on purpose — see onIconContextMenu(). */
    iconMenuIcon: string|null = null
    iconMenuX = 0
    iconMenuY = 0
    private iconMenuPositionDirty = false

    newGroupName = ''
    renameValue = ''
    profileTemplates: { provider: ProfileProvider<Profile>, template: PartialProfile<Profile> }[] = []

    // Pug/Angular ends up serializing the template's *ngIf attribute value
    // with double quotes and HTML-entity-escaping any literal `"` inside it
    // (e.g. `contextMenuMode === "icon"` becomes `contextMenuMode === &quot;icon&quot;`
    // in the compiled template string) — comparing against a boolean getter
    // instead of a quoted string literal sidesteps that escaping entirely.
    get isMenuMode (): boolean {
        return this.contextMenuMode === 'menu'
    }

    get isIconPickerMode (): boolean {
        return this.contextMenuMode === 'icon'
    }

    get isCreateGroupMode (): boolean {
        return this.contextMenuMode === 'createGroup'
    }

    get isCreateProfileMode (): boolean {
        return this.contextMenuMode === 'createProfile'
    }

    get isConfirmDeleteProfileMode (): boolean {
        return this.contextMenuMode === 'confirmDeleteProfile'
    }

    get isRenameMode (): boolean {
        return this.contextMenuMode === 'rename'
    }

    get isWorkspaceMenuMode (): boolean {
        return this.contextMenuMode === 'workspaceMenu'
    }

    get isCreateWorkspaceMode (): boolean {
        return this.contextMenuMode === 'createWorkspace'
    }

    get isRenameWorkspaceMode (): boolean {
        return this.contextMenuMode === 'renameWorkspace'
    }

    get isConfirmDeleteWorkspaceMode (): boolean {
        return this.contextMenuMode === 'confirmDeleteWorkspace'
    }

    iconQuery = ''
    iconMatches: PickerIcon[] = []
    showCustomSvgInput = false
    customSvgText = ''
    customSvgError: string|null = null
    customSvgWarning: string|null = null

    private static readonly MAX_RECENT_ICONS = 20

    constructor (
        private config: ConfigService,
        private profilesService: ProfilesService,
        private app: AppService,
        private notifications: NotificationsService,
        private ngbModal: NgbModal,
        @Inject(ProfileProvider) private profileProviders: ProfileProvider<Profile>[],
    ) { }

    async ngOnInit (): Promise<void> {
        await this.loadTreeItems()
        this.config.changed$.subscribe(() => this.loadTreeItems())

        this.refreshProfileStatuses()
        this.statusSubscription = merge(
            this.app.tabsChanged$,
            this.app.tabOpened$,
            this.app.tabClosed$,
            this.app.tabRemoved$,
            timer(2000, 2000),
        ).subscribe(() => this.refreshProfileStatuses())
    }

    ngOnDestroy (): void {
        this.statusSubscription?.unsubscribe()
        if (this.modalWatchInterval) {
            clearInterval(this.modalWatchInterval)
        }
    }

    ngAfterViewChecked (): void {
        if (this.iconMenuPositionDirty) {
            this.iconMenuPositionDirty = false
            setTimeout(() => {
                const menu = document.querySelector<HTMLElement>('.icon-context-menu')
                if (!menu) {
                    return
                }
                const { x, y } = clampInViewport(menu, this.iconMenuX, this.iconMenuY)
                this.iconMenuX = x
                this.iconMenuY = y
                menu.style.left = `${x}px`
                menu.style.top = `${y}px`
            })
        }
        if (!this.menuPositionDirty) {
            return
        }
        this.menuPositionDirty = false
        // Deferred by one turn of the event loop instead of measuring right
        // here. When a menu item swaps one popup for another (mode 'menu' →
        // 'createGroup'), both *ngIf branches flip in the SAME change
        // detection pass, and the DOM read from ngAfterViewChecked still
        // contains the OUTGOING element: the clamp then measures the old
        // menu's height instead of the new popup's and concludes there is
        // nothing to correct. Measured 2026-07-29 on the real bug:
        // `mode=createGroup elt=group-context-menu h=74` while the popup that
        // actually rendered was 109px tall — off-screen by exactly the 35px
        // difference. Opening a menu by right-click was unaffected only
        // because the previous popup had been destroyed in an earlier pass,
        // leaving the DOM already consistent.
        //
        // setTimeout is patched by Zone.js, so the callback runs inside
        // Angular and the corrected contextMenuX/Y are picked up by the pass
        // it schedules. No loop: menuPositionDirty is already false and the
        // clamp never sets it back.
        setTimeout(() => this.clampContextMenuPosition())
    }

    /** Keeps whichever context menu/popup is currently open fully within the viewport — a right-click near the bottom/right edge of a tall sidebar would otherwise render partially under the taskbar or off-screen and be unusable. */
    private clampContextMenuPosition (): void {
        const menu = document.querySelector<HTMLElement>('.group-context-menu, .icon-picker, .create-popup')
        if (!menu) {
            return
        }
        const { x, y } = clampInViewport(menu, this.contextMenuX, this.contextMenuY)
        if (x !== this.contextMenuX || y !== this.contextMenuY) {
            this.contextMenuX = x
            this.contextMenuY = y
            // Written straight onto the element as well as onto the bound
            // fields. This runs in ngAfterViewChecked, i.e. *after* Angular
            // has already rendered [style.left.px]/[style.top.px] for this
            // pass, so updating the fields alone only reaches the DOM if some
            // later event happens to schedule another change-detection pass.
            //
            // That is exactly why the bug looked selective: a right-click menu
            // is opened on `contextmenu`, which is followed by `mouseup` —
            // that extra event ran another pass and the corrected position
            // landed by luck. A popup opened from a menu item (new folder,
            // rename, delete confirmation, icon picker) is opened on `click`,
            // the LAST event of its sequence, so nothing ever repainted it and
            // it stayed wherever it first rendered, off-screen included.
            // Assigning the style here makes the clamp land on the same frame
            // the popup appears, for every popup, whatever opened it.
            // detectChanges() would also work but risks a loop from inside
            // ngAfterViewChecked.
            menu.style.left = `${x}px`
            menu.style.top = `${y}px`
        }
    }

    /**
     * Returns whether this call's results were actually applied to
     * this.profileGroups/this.rootGroups. False means a newer loadTreeItems()
     * call was started (by config.changed$ or an explicit workspace switch)
     * before this one finished, and its results were discarded in favor of
     * that newer call's — see the requestId guard at the end.
     */
    private async loadTreeItems (): Promise<boolean> {
        const requestId = ++this.loadTreeRequestId
        const profileGroupCollapsed = JSON.parse(window.localStorage.sidebarPlusGroupCollapsed ?? '{}')

        // Snapshot workspace state now, before the first await below.
        // Re-reading this.activeWorkspaceId/this.workspaces *after* an await
        // would risk this call picking up a mutation made by a different,
        // concurrently-running call (e.g. switching workspaces twice in
        // quick succession) partway through its own computation — exactly
        // the class of bug the final requestId check guards against.
        const workspaces = this.config.store.sidebarPlus?.workspaces ?? []
        let activeWorkspaceId = this.activeWorkspaceId
        if (activeWorkspaceId !== 'all' && !workspaces.some(w => w.id === activeWorkspaceId)) {
            // Active workspace was deleted (e.g. from another machine's sync) — fall back rather than filtering on stale ids forever.
            activeWorkspaceId = 'all'
        }
        const workspace = activeWorkspaceId === 'all' ? null : (workspaces.find(w => w.id === activeWorkspaceId) ?? null)

        let groups = await this.profilesService.getProfileGroups({ includeNonUserGroup: true, includeProfiles: true })
        // getProfileGroups() does not guarantee a deep clone. buildGroupTree()
        // below assigns a computed `.children` array onto each group object —
        // if those objects are live references into config.store.groups,
        // that computed property gets serialized back into config.yaml on the
        // next config.save(), corrupting it (see roadmap piège #12). Clone
        // defensively so nothing we do here can ever touch Tabby's own state.
        groups = structuredClone(groups)

        for (const group of groups) {
            if (group.profiles?.length) {
                group.profiles = group.profiles.filter(x => !x.isTemplate)
                group.profiles = group.profiles.filter(x => x.id && !this.config.store.profileBlacklist.includes(x.id))
            }
        }

        // Independent copy, kept *not* filtered by workspace visibility —
        // the "show hidden" panel (hiddenGroupsInWorkspace/
        // hiddenProfilesInWorkspace) needs to render name/icon for groups
        // and profiles the tree below is about to filter out. Must be a
        // separate clone, not just a reference to `groups`: the profile
        // sort/filter below mutates each group's `.profiles` in place.
        const rawGroupsSnapshot = structuredClone(groups)

        const { hiddenGroupIds, hiddenProfileIds } = SidebarPlusTreeComponent.computeWorkspaceFilterState(groups, workspace)

        if (hiddenGroupIds.size) {
            groups = groups.filter(g => !hiddenGroupIds.has(g.id))
        }

        // Sibling order (both groups and profiles) is independent per
        // workspace: a workspace's own groupOrder/profileOrder takes
        // priority when it has an entry for that parent/group, otherwise
        // falls back to the "Tous" order (top-level groupOrder / native
        // weight) — so a freshly created workspace starts out matching the
        // current visual order until the user reorders within it.
        for (const group of groups) {
            if (group.profiles?.length) {
                if (hiddenProfileIds.size) {
                    group.profiles = group.profiles.filter(x => !hiddenProfileIds.has(x.id!))
                }
                const workspaceProfileOrder = workspace?.profileOrder?.[group.id]
                if (workspaceProfileOrder?.length) {
                    // Same per-item fallback as groupOrderIndex() below: a
                    // profile the user never reordered in this workspace keeps
                    // its "Tous" position (native weight) instead of being
                    // dumped at the end of the list.
                    const profileOrderIndex = (p: PartialProfile<Profile>): number =>
                        (p.id ? workspaceProfileOrder.indexOf(p.id) : -1)
                    group.profiles.sort((a, b) => {
                        const ia = profileOrderIndex(a)
                        const ib = profileOrderIndex(b)
                        if (ia !== -1 && ib !== -1) {
                            return ia - ib
                        }
                        return (a.weight ?? 0) - (b.weight ?? 0)
                    })
                } else {
                    group.profiles.sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0))
                }
            }
        }

        if (!this.config.store.terminal.showBuiltinProfiles) {
            groups = groups.filter(g => g.id !== 'built-in')
        }
        groups = groups.filter(g => g.id !== 'ungrouped' || (g.profiles?.length ?? 0) > 0)

        const topGroupOrder: Record<string, string[]> = this.config.store.sidebarPlus?.groupOrder ?? {}
        // Fallback resolved PER ITEM, not per parent key. The roadmap's rule
        // is "a folder not yet reordered in this workspace falls back to the
        // Tous order", and gating on the whole list (`workspaceOrder?.length
        // ? ... : ...`) did not implement it: as soon as a workspace had any
        // entry for that parent, every folder missing from it — including one
        // the user had never touched there — skipped the "Tous" order entirely
        // and went to MAX_SAFE_INTEGER, i.e. straight to alphabetical.
        // A list holding only dead ids (which the reparent bug above produced)
        // is the extreme case: non-empty, so it suppressed the fallback
        // completely while ordering nothing at all.
        const groupOrderIndex = (g: PartialProfileGroup<ProfileGroup>): number => {
            const parentKey = (g as any).parentGroupId ?? 'root'
            const workspaceIndex = workspace?.groupOrder?.[parentKey]?.indexOf(g.id) ?? -1
            if (workspaceIndex !== -1) {
                return workspaceIndex
            }
            const topIndex = topGroupOrder[parentKey]?.indexOf(g.id) ?? -1
            return topIndex === -1 ? Number.MAX_SAFE_INTEGER : topIndex
        }
        groups.sort((a, b) => groupOrderIndex(a) - groupOrderIndex(b) || a.name.localeCompare(b.name))
        groups.sort((a, b) => (a.id === 'built-in' || !a.editable ? 1 : 0) - (b.id === 'built-in' || !b.editable ? 1 : 0))
        groups.sort((a, b) => (a.id === 'ungrouped' ? 0 : 1) - (b.id === 'ungrouped' ? 0 : 1))

        const profileGroups = groups.map(g => SidebarPlusTreeComponent.intoCollapsable(g, profileGroupCollapsed[g.id] ?? false))
        const rootGroups = this.applyFavorites(this.profilesService.buildGroupTree(profileGroups), workspace, profileGroups)

        if (requestId !== this.loadTreeRequestId) {
            // Superseded by a newer call started while we were awaiting above — discard, the newer call owns the final state.
            return false
        }

        this.workspaces = workspaces
        this.activeWorkspaceId = activeWorkspaceId
        window.localStorage.sidebarPlusActiveWorkspace = activeWorkspaceId
        this.rawGroupsSnapshot = rawGroupsSnapshot
        this.profileGroups = profileGroups
        this.rootGroups = rootGroups
        return true
    }

    /**
     * Computes, from the *unfiltered* raw group list, the cascaded set of
     * hidden group ids (a hidden parent hides its descendants too, for
     * rendering — buildGroupTree() would otherwise silently drop orphaned
     * children rather than promoting them) and the hidden profile ids. Pure
     * function of its arguments so loadTreeItems() can call it safely
     * regardless of what this.activeWorkspace might have changed to by the
     * time an overlapping call resumes.
     */
    private static computeWorkspaceFilterState (
        rawGroups: PartialProfileGroup<ProfileGroup>[],
        workspace: SidebarWorkspace|null,
    ): { hiddenGroupIds: Set<string>, hiddenProfileIds: Set<string> } {
        if (!workspace) {
            return { hiddenGroupIds: new Set(), hiddenProfileIds: new Set() }
        }

        const byId = new Map(rawGroups.map(g => [g.id, g]))
        const directHidden = new Set(workspace.hiddenGroupIds)
        const cache = new Map<string, boolean>()
        const isHiddenById = (id: string): boolean => {
            if (cache.has(id)) {
                return cache.get(id)!
            }
            let result: boolean
            if (directHidden.has(id)) {
                result = true
            } else {
                const parentId = byId.get(id)?.parentGroupId
                result = parentId ? isHiddenById(parentId) : false
            }
            cache.set(id, result)
            return result
        }

        return {
            hiddenGroupIds: new Set(rawGroups.filter(g => isHiddenById(g.id)).map(g => g.id)),
            hiddenProfileIds: new Set(workspace.hiddenProfileIds),
        }
    }

    async launchProfile<P extends Profile> (profile: PartialProfile<P>): Promise<any> {
        return this.profilesService.launchProfile(profile)
    }

    async launchProfileFromMenu (profile: PartialProfile<Profile>): Promise<void> {
        this.closeContextMenu()
        await this.launchProfile(profile)
    }

    /**
     * Minimal version: launches the group's direct profiles only, each in
     * its own tab, no split panes, no recursion into sub-groups. The richer
     * behaviour (layout choice, synced multi-input) is deliberately left to
     * the separate "Group Exec" roadmap item — see ROADMAP.html.
     */
    async launchGroupSessions (group: PartialProfileGroup<CollapsableProfileGroup>): Promise<void> {
        this.closeContextMenu()
        const profiles = group.profiles ?? []
        if (!profiles.length) {
            this.notifications.notice('Ce dossier ne contient aucun profil à lancer')
            return
        }
        await Promise.all(profiles.map(profile => this.launchProfile(profile)))
    }

    async onFilterChange (): Promise<void> {
        const q = this.filter.trim().toLowerCase()

        if (q.length === 0) {
            this.rootGroups = this.applyFavorites(this.profilesService.buildGroupTree(this.profileGroups))
            return
        }

        const profiles = await this.profilesService.getProfiles({
            includeBuiltin: this.config.store.terminal.showBuiltinProfiles,
            clone: true,
        })

        // Deliberately searches everywhere, ignoring the active workspace's
        // visibility filter — a workspace only controls what the *tree*
        // shows by default, it shouldn't make something unfindable by name.
        const matches = new FuzzySearch(
            profiles.filter(p => !p.isTemplate),
            ['name', 'description'],
            { sort: false },
        ).search(q)

        this.rootGroups = [
            {
                id: 'search',
                editable: false,
                name: 'Filter results',
                icon: 'fas fa-magnifying-glass',
                profiles: matches,
            },
        ]
    }

    ////// WORKSPACES //////
    get activeWorkspace (): SidebarWorkspace|null {
        if (this.activeWorkspaceId === 'all') {
            return null
        }
        return this.workspaces.find(w => w.id === this.activeWorkspaceId) ?? null
    }

    selectWorkspace (id: string): void {
        this.activeWorkspaceId = id
        window.localStorage.sidebarPlusActiveWorkspace = id
        this.showHiddenPanel = false
        this.closeContextMenu()
        this.refreshTree()
    }

    /** Single re-entry point after anything that changes what should be visible (workspace switch, config change) — re-derives rootGroups from scratch, honoring an in-progress text filter if there is one. */
    private async refreshTree (): Promise<void> {
        const applied = await this.loadTreeItems()
        if (applied && this.filter.trim()) {
            await this.onFilterChange()
        }
    }

    onWorkspaceTabContextMenu (event: MouseEvent, workspace: SidebarWorkspace): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuGroup = null
        this.contextMenuProfile = null
        this.contextMenuRoot = false
        this.contextMenuWorkspace = workspace
        this.contextMenuMode = 'workspaceMenu'
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
        this.menuPositionDirty = true
    }

    openCreateWorkspacePrompt (event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuWorkspace = null
        this.contextMenuMode = 'createWorkspace'
        this.newWorkspaceName = ''
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
        this.menuPositionDirty = true
    }

    async createWorkspace (): Promise<void> {
        const name = this.newWorkspaceName.trim()
        if (!name) {
            return
        }
        this.config.store.sidebarPlus ??= {}
        const workspaces: SidebarWorkspace[] = this.config.store.sidebarPlus.workspaces ?? []
        const id = `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        workspaces.push({
            id,
            name,
            hiddenProfileIds: [],
            hiddenGroupIds: [],
            favorites: [],
            favoriteGroups: [],
            groupOrder: {},
            profileOrder: {},
        })
        this.config.store.sidebarPlus.workspaces = workspaces
        await this.config.save()
        this.closeContextMenu()
        this.selectWorkspace(id)
    }

    openRenameWorkspacePrompt (): void {
        this.renameWorkspaceValue = this.contextMenuWorkspace?.name ?? ''
        this.contextMenuMode = 'renameWorkspace'
        this.menuPositionDirty = true
    }

    async confirmRenameWorkspace (): Promise<void> {
        const name = this.renameWorkspaceValue.trim()
        if (!name || !this.contextMenuWorkspace) {
            return
        }
        this.config.store.sidebarPlus ??= {}
        const workspaces: SidebarWorkspace[] = this.config.store.sidebarPlus.workspaces ?? []
        const target = workspaces.find(w => w.id === this.contextMenuWorkspace!.id)
        if (target) {
            target.name = name
        }
        this.config.store.sidebarPlus.workspaces = workspaces
        await this.config.save()
        this.closeContextMenu()
    }

    confirmDeleteWorkspacePrompt (): void {
        this.contextMenuMode = 'confirmDeleteWorkspace'
        this.menuPositionDirty = true
    }

    async deleteWorkspace (): Promise<void> {
        if (!this.contextMenuWorkspace) {
            return
        }
        const id = this.contextMenuWorkspace.id
        this.config.store.sidebarPlus ??= {}
        const workspaces: SidebarWorkspace[] = (this.config.store.sidebarPlus.workspaces ?? []).filter(w => w.id !== id)
        this.config.store.sidebarPlus.workspaces = workspaces
        await this.config.save()
        this.closeContextMenu()
        if (this.activeWorkspaceId === id) {
            this.selectWorkspace('all')
        }
    }

    ////// WORKSPACE VISIBILITY (hide from the profile/group context menu, restore from the hidden-items panel) //////
    /** Single-click hide, no picker — always targets the active workspace. Meaningless (and hidden in the template) on "Tous", which never hides anything. */
    async hideInActiveWorkspace (): Promise<void> {
        const workspace = this.activeWorkspace
        if (!workspace) {
            return
        }
        if (this.contextMenuProfile?.id) {
            if (!workspace.hiddenProfileIds.includes(this.contextMenuProfile.id)) {
                workspace.hiddenProfileIds.push(this.contextMenuProfile.id)
            }
        } else if (this.contextMenuGroup) {
            if (!workspace.hiddenGroupIds.includes(this.contextMenuGroup.id)) {
                workspace.hiddenGroupIds.push(this.contextMenuGroup.id)
            }
        } else {
            return
        }
        this.config.store.sidebarPlus ??= {}
        this.config.store.sidebarPlus.workspaces = this.workspaces
        await this.config.save()
        this.closeContextMenu()
    }

    /**
     * Groups/profiles *directly* hidden in the active workspace (not
     * cascade-hidden descendants of a hidden parent) — backs the "show
     * hidden" panel next to the filter bar. Reads rawGroupsSnapshot (not
     * profileGroups) since these items are, by definition, excluded from
     * the normal filtered tree.
     */
    get hiddenGroupsInWorkspace (): PartialProfileGroup<ProfileGroup>[] {
        const workspace = this.activeWorkspace
        if (!workspace?.hiddenGroupIds.length) {
            return []
        }
        return this.rawGroupsSnapshot.filter(g => workspace.hiddenGroupIds.includes(g.id))
    }

    get hiddenProfilesInWorkspace (): PartialProfile<Profile>[] {
        const workspace = this.activeWorkspace
        if (!workspace?.hiddenProfileIds.length) {
            return []
        }
        const allProfiles = this.rawGroupsSnapshot.flatMap(g => g.profiles ?? [])
        return allProfiles.filter(p => p.id && workspace.hiddenProfileIds.includes(p.id))
    }

    async restoreGroupInWorkspace (group: PartialProfileGroup<ProfileGroup>): Promise<void> {
        const workspace = this.activeWorkspace
        if (!workspace) {
            return
        }
        const index = workspace.hiddenGroupIds.indexOf(group.id)
        if (index !== -1) {
            workspace.hiddenGroupIds.splice(index, 1)
        }
        this.config.store.sidebarPlus ??= {}
        this.config.store.sidebarPlus.workspaces = this.workspaces
        await this.config.save()
    }

    async restoreProfileInWorkspace (profile: PartialProfile<Profile>): Promise<void> {
        const workspace = this.activeWorkspace
        if (!workspace || !profile.id) {
            return
        }
        const index = workspace.hiddenProfileIds.indexOf(profile.id)
        if (index !== -1) {
            workspace.hiddenProfileIds.splice(index, 1)
        }
        this.config.store.sidebarPlus ??= {}
        this.config.store.sidebarPlus.workspaces = this.workspaces
        await this.config.save()
    }

    ////// SFTP VIEW //////
    setSftpMode (on: boolean): void {
        this.sftpMode = on
        window.localStorage.sidebarPlusSftpMode = on ? 'true' : 'false'
        if (on) {
            // Leaving this on would put the sidebar back into the hidden-items
            // panel — not the tree — the next time SFTP is switched off.
            this.showHiddenPanel = false
        }
    }

    ////// RESIZING //////
    startResize (event: MouseEvent): void {
        this.panelIsResizing = true
        this.panelStartX = event.clientX
        this.panelStartWidth = this.panelWidth
        event.preventDefault()
    }

    ////// DRAG DIRECTION RESCUE //////
    // CDK caches every connected list's clientRect when the drag starts and
    // never refreshes it, but its own reorder preview shifts the intervening
    // rows by `transform` — so when a folder is dragged *downwards*, each
    // candidate target's cached rect and its on-screen rect end up 29px apart
    // (one row) and never overlap. `_canReceive` needs the pointer inside
    // both at once, so there is literally no position that lets CDK see the
    // drop: every downward nest silently degrades into a root-level reorder.
    // Dragging upwards works because the pointer meets the target's drop zone
    // before crossing the row centre that triggers the shift.
    //
    // Rather than fight the cache, track the folder actually under the
    // pointer ourselves, measured live (so transforms are included — it is
    // what the user sees), and let onGroupDrop() use it to rescue a drop CDK
    // resolved to the root. Verified 2026-07-28: downward drops onto a
    // neighbour one *and* three rows below both failed before this.
    private draggedGroupId: string|null = null
    /** Folder whose row the pointer is over, or null — only meaningful while draggedGroupId is set. */
    private hoveredGroupId: string|null = null

    onGroupDragStarted (group: PartialProfileGroup<CollapsableProfileGroup>): void {
        this.draggedGroupId = group.id
        this.hoveredGroupId = null
    }

    /**
     * Only stops the tracking — `hoveredGroupId` is deliberately left set.
     * CDK emits `cdkDragEnded` *before* `cdkDropListDropped`, so clearing it
     * here would wipe the value a fraction of a millisecond before
     * onGroupDrop() reads it, and the rescue would never once fire.
     * onGroupDragStarted() resets it instead.
     */
    onGroupDragEnded (): void {
        this.draggedGroupId = null
    }

    /**
     * Hit-tests the folder rows directly rather than going through
     * `document.elementFromPoint`: the drop-zone overlays defined in the scss
     * cover the lower half of a row and would answer instead of the row
     * itself, and they are exactly what is unreliable here.
     */
    private updateHoveredGroup (x: number, y: number): void {
        this.hoveredGroupId = null
        const rows = document.querySelectorAll<HTMLElement>('.sidebar-plus-tree a.tree-item[data-group-id]')
        for (const row of Array.from(rows)) {
            const rect = row.getBoundingClientRect()
            // Lower half only: the upper half keeps meaning "reorder next to
            // this folder", matching the resting drop-zone geometry so the
            // gesture is the same whichever way CDK happens to resolve it.
            if (x >= rect.left && x <= rect.right && y >= rect.top + rect.height / 2 && y <= rect.bottom) {
                this.hoveredGroupId = row.dataset.groupId ?? null
                return
            }
        }
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove (event: MouseEvent): void {
        if (this.draggedGroupId) {
            this.updateHoveredGroup(event.clientX, event.clientY)
        }
        if (!this.panelIsResizing) { return }
        const delta = event.clientX - this.panelStartX
        const width = Math.min(Math.max(this.panelMinWidth, this.panelStartWidth + delta), this.panelMaxWidth)
        this.panelWidth = width
        window.localStorage.sidebarPlusTreeWidth = width.toString()
    }

    @HostListener('document:mouseup')
    stopResize (): boolean {
        this.panelIsResizing = false
        return true
    }

    @HostBinding('style.width.px')
    get panelWidth (): number {
        return this.panelInternalWidth
    }

    set panelWidth (value: number) {
        this.panelInternalWidth = value
    }

    ////// GROUP COLLAPSING //////
    toggleGroupCollapse (group: PartialProfileGroup<CollapsableProfileGroup>): void {
        group.collapsed = !group.collapsed
        const profileGroupCollapsed = JSON.parse(window.localStorage.sidebarPlusGroupCollapsed ?? '{}')
        profileGroupCollapsed[group.id] = group.collapsed
        window.localStorage.sidebarPlusGroupCollapsed = JSON.stringify(profileGroupCollapsed)
    }

    private static intoCollapsable (group: PartialProfileGroup<ProfileGroup>, collapsed: boolean): PartialProfileGroup<CollapsableProfileGroup> {
        return { ...group, collapsed } as PartialProfileGroup<CollapsableProfileGroup>
    }

    private static groupIdFromContainerId (containerId: string): string {
        return containerId.replace(/^profiles-/, '')
    }

    /** `groups-<id>` → that group's id, `groups-root` → null (the shape persistGroupOrder() expects for the root level). */
    private static parentGroupIdFromGroupContainerId (containerId: string): string|null {
        const id = containerId.replace(/^groups-/, '')
        return id === 'root' ? null : id
    }

    ////// FAVORITES //////
    isFavorite (profile: PartialProfile<Profile>): boolean {
        return !!profile.id && this.favoriteIds.includes(profile.id)
    }

    toggleFavorite (profile: PartialProfile<Profile>, event: Event): void {
        event.preventDefault()
        event.stopPropagation()
        if (!profile.id) {
            return
        }
        this.config.store.sidebarPlus ??= {}
        // "Tous" reuses the pre-existing top-level favorites/favoriteGroups
        // keys (already live in every user's config.yaml, zero migration);
        // every other workspace gets its own list on the workspace object.
        const favorites: string[] = this.activeWorkspace
            ? (this.activeWorkspace.favorites ??= [])
            : (this.config.store.sidebarPlus.favorites ??= [])
        const index = favorites.indexOf(profile.id)
        if (index === -1) {
            favorites.push(profile.id)
        } else {
            favorites.splice(index, 1)
        }
        if (this.activeWorkspace) {
            this.config.store.sidebarPlus.workspaces = this.workspaces
        } else {
            this.config.store.sidebarPlus.favorites = favorites
        }
        this.config.save()
        this.rootGroups = this.applyFavorites(this.rootGroups.filter(g => g.id !== 'favorites'))
    }

    toggleFavoriteFromMenu (profile: PartialProfile<Profile>, event: Event): void {
        this.toggleFavorite(profile, event)
        this.closeContextMenu()
    }

    private get favoriteIds (): string[] {
        return this.activeWorkspace ? (this.activeWorkspace.favorites ?? []) : (this.config.store.sidebarPlus?.favorites ?? [])
    }

    ////// GROUP FAVORITES //////
    // Separate config key from profile favorites: profile IDs and group IDs
    // don't share a documented namespace guarantee, so a combined list would
    // risk a collision that's unlikely but avoidable at zero cost.
    isFavoriteGroup (group: PartialProfileGroup<ProfileGroup>): boolean {
        return this.favoriteGroupIds.includes(group.id)
    }

    toggleFavoriteGroupFromMenu (group: PartialProfileGroup<CollapsableProfileGroup>, event: Event): void {
        event.preventDefault()
        event.stopPropagation()
        this.config.store.sidebarPlus ??= {}
        const favoriteGroups: string[] = this.activeWorkspace
            ? (this.activeWorkspace.favoriteGroups ??= [])
            : (this.config.store.sidebarPlus.favoriteGroups ??= [])
        const index = favoriteGroups.indexOf(group.id)
        if (index === -1) {
            favoriteGroups.push(group.id)
        } else {
            favoriteGroups.splice(index, 1)
        }
        if (this.activeWorkspace) {
            this.config.store.sidebarPlus.workspaces = this.workspaces
        } else {
            this.config.store.sidebarPlus.favoriteGroups = favoriteGroups
        }
        this.config.save()
        this.closeContextMenu()
    }

    private get favoriteGroupIds (): string[] {
        return this.activeWorkspace ? (this.activeWorkspace.favoriteGroups ?? []) : (this.config.store.sidebarPlus?.favoriteGroups ?? [])
    }

    /**
     * `workspace`/`sourceProfileGroups` default to live instance state for
     * the synchronous, non-racy call sites (toggleFavorite*, onFilterChange).
     * loadTreeItems() passes them explicitly instead — it computes against a
     * local snapshot taken before its own await, per the requestId-guard
     * discipline described there, and must not fall back to `this.*` here.
     */
    private applyFavorites (
        groups: PartialProfileGroup<CollapsableProfileGroup>[],
        workspace: SidebarWorkspace|null = this.activeWorkspace,
        sourceProfileGroups: PartialProfileGroup<ProfileGroup>[] = this.profileGroups,
    ): PartialProfileGroup<CollapsableProfileGroup>[] {
        const favoriteIds = workspace ? (workspace.favorites ?? []) : (this.config.store.sidebarPlus?.favorites ?? [])
        if (!favoriteIds.length) {
            return groups
        }

        const allProfiles = sourceProfileGroups.flatMap(g => g.profiles ?? [])
        const favoriteProfiles = favoriteIds
            .map(id => allProfiles.find(p => p.id === id))
            .filter((p): p is PartialProfile<Profile> => !!p)

        if (!favoriteProfiles.length) {
            return groups
        }

        const favoritesGroup = SidebarPlusTreeComponent.intoCollapsable(
            {
                id: 'favorites',
                name: 'Épinglés',
                icon: 'fas fa-star',
                editable: false,
                profiles: favoriteProfiles,
            } as PartialProfileGroup<ProfileGroup>,
            false,
        )

        return [favoritesGroup, ...groups]
    }

    ////// LIVE CONNECTION STATUS //////
    getProfileStatus (profile: PartialProfile<Profile>): ProfileConnectionStatus|null {
        return (profile.id && this.profileStatuses.get(profile.id)) || null
    }

    private refreshProfileStatuses (): void {
        const statuses = new Map<string, ProfileConnectionStatus>()
        for (const tab of this.getAllOpenTabs() as unknown as ProfileBackedTab[]) {
            const profileId = tab.profile?.id
            if (!profileId) {
                continue
            }
            if (tab.session) {
                statuses.set(profileId, 'connected')
            } else if (!statuses.has(profileId)) {
                statuses.set(profileId, 'error')
            }
        }
        this.profileStatuses = statuses
    }

    private getAllOpenTabs (): BaseTabComponent[] {
        return this.app.tabs.flatMap(tab => tab instanceof SplitTabComponent ? tab.getAllTabs() : [tab])
    }

    ////// DRAG & DROP //////
    get profileListIds (): string[] {
        return this.profileGroups.map(g => `profiles-${g.id}`)
    }

    async onProfileDrop (
        event: CdkDragDrop<PartialProfile<Profile>[]>,
        targetGroup: PartialProfileGroup<ProfileGroup>,
    ): Promise<void> {
        const isRealTarget = targetGroup.editable || targetGroup.id === 'ungrouped'
        if (!isRealTarget) {
            return
        }

        const sourceGroupId = SidebarPlusTreeComponent.groupIdFromContainerId(event.previousContainer.id)

        if (event.previousContainer === event.container) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex)
        } else {
            const profile = event.previousContainer.data[event.previousIndex]
            transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex)
            profile.group = targetGroup.id === 'ungrouped' ? undefined : targetGroup.id
            await this.profilesService.writeProfile(profile)
            await this.persistProfileOrder(sourceGroupId, event.previousContainer.data)
        }
        await this.persistProfileOrder(targetGroup.id, event.container.data)
        this.config.save()
    }

    /**
     * Sibling order is per-workspace (see configProvider.ts SidebarWorkspace)
     * — outside "Tous", reordering never touches the profile's own native
     * `weight` (which stays whatever "Tous" last set it to) and instead
     * writes the displayed order into the active workspace's own
     * `profileOrder[groupId]`. This is safe against hidden items: a
     * workspace's order list only needs to describe the profiles actually
     * visible in it, since a hidden profile is never rendered there
     * regardless of its recorded position.
     */
    private async persistProfileOrder (groupId: string, profiles: PartialProfile<Profile>[]): Promise<void> {
        // Before the write, never after: pruning replaces the order maps with
        // fresh objects, so pruning last would discard the entry just made.
        this.pruneDeadOrderIds()
        if (this.activeWorkspace) {
            this.activeWorkspace.profileOrder ??= {}
            this.activeWorkspace.profileOrder[groupId] = profiles.map(p => p.id).filter((id): id is string => !!id)
            this.config.store.sidebarPlus ??= {}
            this.config.store.sidebarPlus.workspaces = this.workspaces
            return
        }
        await this.persistProfileWeights(profiles)
    }

    private async persistProfileWeights (profiles: PartialProfile<Profile>[]): Promise<void> {
        await Promise.all(profiles.map((profile, index) => {
            if ((profile.weight ?? 0) === index) {
                return Promise.resolve()
            }
            profile.weight = index
            return this.profilesService.writeProfile(profile)
        }))
    }

    /**
     * CDK resolves a drop's target container by walking this array in order
     * and taking the FIRST connected list whose element contains the drop
     * point. Every nested `groups-<id>` list is rendered *inside*
     * `#groups-root` (recursive template), so `#groups-root`'s element
     * DOM-contains all of them — if it came first (as it used to), it always
     * won, and a folder drag could never register as entering a nested
     * folder no matter how precisely the user targeted it (confirmed via
     * CDP: `containerId` was `groups-root` on every attempt, even aimed
     * directly at a visible child row). Deepest-nested groups must be
     * checked first, `groups-root` last, so an ancestor list never
     * shadows a descendant one it happens to contain.
     */
    get groupListIds (): string[] {
        return [...SidebarPlusTreeComponent.sortGroupIdsByDepthDesc(this.profileGroups), 'groups-root']
    }

    private static sortGroupIdsByDepthDesc (groups: PartialProfileGroup<ProfileGroup>[]): string[] {
        const byId = new Map(groups.map(g => [g.id, g]))
        const depthCache = new Map<string, number>()
        const depthOf = (id: string): number => {
            if (depthCache.has(id)) {
                return depthCache.get(id)!
            }
            const parentId = (byId.get(id) as any)?.parentGroupId
            const depth = parentId && byId.has(parentId) ? depthOf(parentId) + 1 : 0
            depthCache.set(id, depth)
            return depth
        }
        return [...groups].sort((a, b) => depthOf(b.id) - depthOf(a.id)).map(g => `groups-${g.id}`)
    }

    async onGroupDrop (
        event: CdkDragDrop<PartialProfileGroup<CollapsableProfileGroup>[]>,
        targetParentGroupId: string|null,
    ): Promise<void> {
        const dragged = event.previousContainer.data[event.previousIndex]
        if (!dragged.editable) {
            return
        }

        if (event.previousContainer === event.container) {
            // Before treating this as a plain reorder, check whether the
            // pointer was actually sitting on another folder's row — see the
            // "drag direction rescue" note above: on a downward drag CDK
            // cannot see the nested list at all and reports a root reorder
            // even though the user clearly aimed inside a folder.
            const rescued = this.rescueTargetGroupId(dragged.id)
            if (rescued) {
                // Drop it out of the sibling list we are about to persist:
                // it is leaving this level, so recording it here would write
                // an order entry for a folder that no longer belongs to it.
                const siblings = event.container.data.filter(g => g.id !== dragged.id)
                await this.reparentDraggedGroup(dragged, rescued, targetParentGroupId, siblings)
                return
            }
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex)
            this.persistGroupOrder(targetParentGroupId, event.container.data)
            await this.config.save()
            return
        }

        if (targetParentGroupId) {
            const targetParent = this.profileGroups.find(g => g.id === targetParentGroupId)
            if (!targetParent?.editable || this.isSelfOrDescendant(targetParentGroupId, dragged.id)) {
                return
            }
        }

        transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex)
        // The folder is leaving this list, so the parent it came from must be
        // re-persisted without it — mirrors what onProfileDrop() already does
        // for the source group. Skipping it left the moved folder's id sitting
        // in its former parent's order list forever (seen in the user's real
        // config on 2026-07-29: the same id listed both under `root` and under
        // the folder it had been nested into).
        this.persistGroupOrder(
            SidebarPlusTreeComponent.parentGroupIdFromGroupContainerId(event.previousContainer.id),
            event.previousContainer.data,
        )
        await this.reparentDraggedGroup(dragged, targetParentGroupId, targetParentGroupId, event.container.data)
    }

    /**
     * The folder the pointer was really over, when it is a legal nest target
     * for `draggedId` — or null, meaning the drop should stay a plain
     * reorder. See the "drag direction rescue" note above for why CDK cannot
     * be trusted to have noticed it on a downward drag.
     */
    private rescueTargetGroupId (draggedId: string): string|null {
        const hovered = this.hoveredGroupId
        if (!hovered || hovered === draggedId) {
            return null
        }
        const target = this.profileGroups.find(g => g.id === hovered)
        if (!target?.editable || this.isSelfOrDescendant(hovered, draggedId)) {
            return null
        }
        // Already sitting in that folder: nesting would be a no-op that still
        // pays the full recreate/migrate/delete cost (and a new id), so let
        // the normal reorder run instead.
        if (this.rawGroupsSnapshot.find(g => g.id === draggedId)?.parentGroupId === hovered) {
            return null
        }
        return hovered
    }

    private async reparentDraggedGroup (
        dragged: PartialProfileGroup<CollapsableProfileGroup>,
        newParentGroupId: string|null,
        orderKeyParentGroupId: string|null,
        siblingsToPersist: PartialProfileGroup<CollapsableProfileGroup>[],
    ): Promise<void> {
        let allGroups = await this.profilesService.getProfileGroups({ includeNonUserGroup: true, includeProfiles: true })
        allGroups = structuredClone(allGroups)
        try {
            const newId = await this.reparentGroup(dragged.id, dragged, newParentGroupId, allGroups)
            // The folder now lives under a brand-new id, but `dragged` is the
            // rendered tree node and still carries the old one — and it is a
            // member of siblingsToPersist. Without this, persistGroupOrder()
            // below writes the OLD id into the new parent's order list, right
            // after migrateWorkspaceGroupId() has carefully rewritten every
            // other reference to the new one: the entry then points at a group
            // that no longer exists, the folder has no recorded position in
            // its new parent, and it silently falls back to being sorted last.
            // Found in the user's real config on 2026-07-29 as a dead id
            // (`526eac40: [a776a5b3]`) after a nesting drag.
            //
            // Safe to mutate: this node comes from the structuredClone() taken
            // in loadTreeItems(), never from a live config.store object
            // (piège #12).
            dragged.id = newId
        } catch (err) {
            // Deliberately not rethrown: this runs as an async Angular event
            // handler, so a rethrow becomes an unhandled promise rejection —
            // noise on top of the toast the user already gets, and it would
            // skip the config.save() below that persists whatever partial
            // migration did land. console.error keeps it diagnosable.
            // eslint-disable-next-line no-console
            console.error('[sidebarPlus] reparentGroup a échoué', err)
            this.notifications.error('Le déplacement du dossier a échoué', String(err))
        }
        this.persistGroupOrder(orderKeyParentGroupId, siblingsToPersist)
        await this.config.save()
    }

    /**
     * Drops ids that match no existing group/profile from every order map —
     * top-level and per workspace, keys as well as values.
     *
     * Order lists accumulate dead ids on their own: re-parenting a folder
     * retires its id (piège #12 forces a recreate), deleting a group or
     * profile retires it outright, and neither path can rewrite every list
     * that happened to mention it. Left alone they are mostly inert, but they
     * make the maps unreadable when diagnosing an ordering problem, and one
     * of them masked a real bug once (piège #31: a list holding nothing but
     * dead ids still counted as "non-empty").
     *
     * Runs on every order write rather than on load: self-repairing without
     * ever rewriting config.yaml behind a user who is only reading the tree.
     */
    private pruneDeadOrderIds (): void {
        const groups = this.config.store.groups
        const profiles = this.config.store.profiles
        // Guard against wiping every order map if the store is momentarily
        // empty (mid-load, or a config that failed to parse): no groups means
        // no evidence, not "nothing exists".
        if (!groups?.length) {
            return
        }
        const liveGroupIds = new Set<string>(groups.map((g: PartialProfileGroup<ProfileGroup>) => g.id))
        const liveProfileIds = new Set<string>((profiles ?? []).map((p: PartialProfile<Profile>) => p.id).filter(Boolean))

        // 'root' is the top level itself and 'ungrouped' is Tabby's synthetic
        // catch-all — neither is a real group, both are legitimate keys.
        const keptKey = (key: string): boolean => key === 'root' || key === 'ungrouped' || liveGroupIds.has(key)

        // Returns a fresh object rather than mutating in place: the result is
        // assigned back explicitly below, which is what actually makes the
        // change persist (piège #23).
        const prune = (order: Record<string, string[]>|undefined, liveValues: Set<string>): Record<string, string[]> => {
            const pruned: Record<string, string[]> = {}
            for (const [key, ids] of Object.entries(order ?? {})) {
                if (keptKey(key)) {
                    pruned[key] = ids.filter(id => liveValues.has(id))
                }
            }
            return pruned
        }

        const sidebarPlus = this.config.store.sidebarPlus
        if (!sidebarPlus) {
            return
        }
        sidebarPlus.groupOrder = prune(sidebarPlus.groupOrder, liveGroupIds)
        const workspaces: SidebarWorkspace[] = sidebarPlus.workspaces ?? []
        for (const ws of workspaces) {
            ws.groupOrder = prune(ws.groupOrder, liveGroupIds)
            ws.profileOrder = prune(ws.profileOrder, liveProfileIds)
        }
        sidebarPlus.workspaces = workspaces
    }

    /** Sibling order is per-workspace — see persistProfileOrder() above for the same reasoning applied to groups. */
    private persistGroupOrder (parentGroupId: string|null, groups: PartialProfileGroup<CollapsableProfileGroup>[]): void {
        const key = parentGroupId ?? 'root'
        const orderedIds = groups.filter(g => g.editable).map(g => g.id)
        this.config.store.sidebarPlus ??= {}
        this.pruneDeadOrderIds()
        if (this.activeWorkspace) {
            this.activeWorkspace.groupOrder ??= {}
            this.activeWorkspace.groupOrder[key] = orderedIds
            this.config.store.sidebarPlus.workspaces = this.workspaces
            return
        }
        // this.config.store.sidebarPlus is Tabby's reactive config store —
        // mutating a nested property in place (`.groupOrder[key] = ...`)
        // without a final explicit assignment back onto `sidebarPlus` is
        // never picked up as a change to persist, unlike every other write
        // in this file (favorites/recentIcons/workspaces), which all end
        // with an explicit `this.config.store.sidebarPlus.X = value`. Real
        // bug found 2026-07-28: root-level (and nested) group reordering on
        // "Tous" silently never persisted, snapping back on every reload.
        const groupOrder = this.config.store.sidebarPlus.groupOrder ?? {}
        groupOrder[key] = orderedIds
        this.config.store.sidebarPlus.groupOrder = groupOrder
    }

    /**
     * profilesService.writeProfileGroup() only updates an existing flat
     * top-level config.store.groups entry — it cannot relocate a group
     * between parents (see roadmap piège #12: a naive parentGroupId
     * reassignment corrupted real user data). Instead, recreate an
     * equivalent group under the new parent, migrate its profiles and child
     * groups into it one at a time (writeProfile/newProfileGroup/
     * deleteProfileGroup are all already proven safe), then delete the
     * now-empty original.
     *
     * Migrates from `allGroups` — a full, workspace-*unfiltered* snapshot
     * fetched once by the caller — rather than the dragged item's own
     * `.children`/`.profiles` (which come from the displayed, possibly
     * workspace-filtered tree). Using the filtered tree would silently
     * orphan anything hidden in the active workspace: its parentGroupId
     * would keep pointing at the original group id after that id is
     * deleted below.
     */
    private async reparentGroup (
        groupId: string,
        meta: { name: string, icon?: string, color?: string },
        newParentGroupId: string|null,
        allGroups: PartialProfileGroup<ProfileGroup>[],
    ): Promise<string> {
        const replacement = {
            id: '',
            name: meta.name,
            icon: meta.icon,
            color: meta.color,
            parentGroupId: newParentGroupId ?? undefined,
        } as PartialProfileGroup<ProfileGroup>
        await this.profilesService.newProfileGroup(replacement, { genId: true })

        const fullGroup = allGroups.find(g => g.id === groupId)
        for (const profile of (fullGroup?.profiles ?? []).filter(p => !p.isTemplate)) {
            profile.group = replacement.id
            await this.profilesService.writeProfile(profile)
        }
        for (const child of allGroups.filter(g => g.parentGroupId === groupId)) {
            await this.reparentGroup(child.id, child, replacement.id, allGroups)
        }

        // The group just got a brand-new id — every workspace's hide/order
        // state that referenced the old one must follow, or the move
        // silently drops it out of whatever hide/order state it had
        // everywhere (not just in the workspace the move was made from).
        this.migrateWorkspaceGroupId(groupId, replacement.id)

        await this.profilesService.deleteProfileGroup((fullGroup ?? { id: groupId }) as PartialProfileGroup<ProfileGroup>)
        // Returned so the caller can persist the sibling order under the NEW
        // id — see reparentDraggedGroup().
        return replacement.id
    }

    private migrateWorkspaceGroupId (oldId: string, newId: string): void {
        this.config.store.sidebarPlus ??= {}
        const workspaces: SidebarWorkspace[] = this.config.store.sidebarPlus.workspaces ?? []
        for (const ws of workspaces) {
            const hiddenIndex = ws.hiddenGroupIds.indexOf(oldId)
            if (hiddenIndex !== -1) {
                ws.hiddenGroupIds[hiddenIndex] = newId
            }
            SidebarPlusTreeComponent.renameOrderKey(ws.groupOrder, oldId, newId)
        }
        this.config.store.sidebarPlus.workspaces = workspaces

        this.config.store.sidebarPlus.groupOrder ??= {}
        SidebarPlusTreeComponent.renameOrderKey(this.config.store.sidebarPlus.groupOrder, oldId, newId)
    }

    /** Renames `oldId` to `newId` both as a value wherever it appears in a sibling order list, and as the map's own parent key (siblings ordered *under* that group). */
    private static renameOrderKey (order: Record<string, string[]>|undefined, oldId: string, newId: string): void {
        if (!order) {
            return
        }
        for (const key of Object.keys(order)) {
            const index = order[key].indexOf(oldId)
            if (index !== -1) {
                order[key][index] = newId
            }
        }
        if (order[oldId]) {
            order[newId] = order[oldId]
            delete order[oldId]
        }
    }

    /**
     * True if `candidateId` is `ancestorId` itself or nested somewhere under
     * it (used to block re-parenting a group into its own subtree). Walks
     * `rawGroupsSnapshot` (workspace-*unfiltered*) rather than
     * `profileGroups` — an ancestor chain that happens to pass through a
     * group hidden in the active workspace would otherwise break the walk
     * early and under-detect a genuine self/descendant cycle.
     */
    private isSelfOrDescendant (candidateId: string, ancestorId: string): boolean {
        let current = this.rawGroupsSnapshot.find(g => g.id === candidateId)
        while (current) {
            if (current.id === ancestorId) {
                return true
            }
            current = current.parentGroupId ? this.rawGroupsSnapshot.find(g => g.id === current!.parentGroupId) : undefined
        }
        return false
    }

    ////// GROUP DELETION (context menu) //////
    onGroupContextMenu (event: MouseEvent, group: PartialProfileGroup<CollapsableProfileGroup>): void {
        event.preventDefault()
        event.stopPropagation()
        if (!group.editable) {
            return
        }
        this.contextMenuProfile = null
        this.contextMenuGroup = group
        this.contextMenuRoot = false
        this.contextMenuMode = 'menu'
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
        this.menuPositionDirty = true
    }

    /** Right-click on empty sidebar space (not on any group/profile row) — offers root-level creation. */
    onSidebarContextMenu (event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuGroup = null
        this.contextMenuProfile = null
        this.contextMenuRoot = true
        this.contextMenuMode = 'menu'
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
        this.menuPositionDirty = true
    }

    closeContextMenu (): void {
        this.contextMenuGroup = null
        this.contextMenuProfile = null
        this.contextMenuRoot = false
        this.contextMenuWorkspace = null
        this.contextMenuMode = 'menu'
        this.closeIconMenu()
    }

    // Checks the click's target rather than relying on descendant
    // (click)='$event.stopPropagation()' bindings to suppress this — those
    // bindings don't reliably stop this HostListener('document:click') from
    // firing regardless (observed via console.trace: it runs synchronously
    // right after a menu item's own click handler, even for items whose
    // ancestor .group-context-menu has a stopPropagation click binding).
    @HostListener('document:click', ['$event'])
    onDocumentClick (event: MouseEvent): void {
        const target = event.target as HTMLElement
        if (target.closest('.icon-context-menu')) {
            return
        }
        // Closed on any click outside itself, including clicks landing inside
        // the picker underneath — that click means "I'm done with this menu",
        // and the picker must survive it (it is what the menu acts upon).
        this.closeIconMenu()
        if (target.closest('.group-context-menu, .icon-picker, .create-popup')) {
            return
        }
        this.closeContextMenu()
    }

    ////// RENAME (context menu, inline — no modal) //////
    openRenamePrompt (): void {
        this.renameValue = this.contextMenuProfile?.name ?? this.contextMenuGroup?.name ?? ''
        this.contextMenuMode = 'rename'
        this.menuPositionDirty = true
    }

    async confirmRename (): Promise<void> {
        const name = this.renameValue.trim()
        if (!name) {
            return
        }
        if (this.contextMenuProfile) {
            this.contextMenuProfile.name = name
            await this.profilesService.writeProfile(this.contextMenuProfile)
        } else if (this.contextMenuGroup) {
            // Minimal {id, name} object only — see applyIcon() above for why
            // (never pass contextMenuGroup itself, it carries plugin-computed
            // fields that writeProfileGroup() would Object.assign() straight
            // into config.yaml, roadmap piège #12).
            await this.profilesService.writeProfileGroup({ id: this.contextMenuGroup.id, name } as PartialProfileGroup<ProfileGroup>)
        } else {
            return
        }
        await this.config.save()
        this.closeContextMenu()
    }

    ////// GROUP / PROFILE CREATION (context menu) //////
    openCreateGroupPrompt (): void {
        this.contextMenuMode = 'createGroup'
        this.newGroupName = ''
        this.menuPositionDirty = true
    }

    async createGroup (): Promise<void> {
        const name = this.newGroupName.trim()
        if (!name) {
            return
        }
        const parentGroupId = this.contextMenuGroup?.id
        await this.profilesService.newProfileGroup({ name, parentGroupId } as PartialProfileGroup<ProfileGroup>, { genId: true })
        await this.config.save()
        this.closeContextMenu()
    }

    async openCreateProfilePicker (): Promise<void> {
        this.contextMenuMode = 'createProfile'
        this.menuPositionDirty = true
        const perProvider = await Promise.all(this.profileProviders.map(async provider => ({
            provider,
            templates: (await provider.getBuiltinProfiles()).filter(p => p.isTemplate),
        })))
        this.profileTemplates = perProvider.flatMap(({ provider, templates }) => templates.map(template => ({ provider, template })))
        // The list grew after the await above — re-clamp now that the popup has its real, final size.
        this.menuPositionDirty = true
    }

    async pickProfileTemplate (entry: { provider: ProfileProvider<Profile>, template: PartialProfile<Profile> }): Promise<void> {
        const groupId = this.contextMenuGroup?.id
        const base = structuredClone(entry.template) as PartialProfile<Profile> & { isTemplate?: boolean, isBuiltin?: boolean, weight?: number }
        delete base.isTemplate
        delete base.isBuiltin
        delete base.weight
        base.group = groupId
        this.closeContextMenu()

        const modal = this.ngbModal.open(EditProfileModalComponent, { size: 'lg' })
        modal.componentInstance.partialProfile = base
        modal.componentInstance.profileProvider = entry.provider

        const result = await modal.result.catch(() => null) as PartialProfile<Profile>|null
        if (!result) {
            return
        }
        result.type = entry.provider.id
        if (!result.name) {
            const cfgProxy = this.profilesService.getConfigProxyForProfile(result)
            result.name = entry.provider.getSuggestedName(cfgProxy) ?? entry.provider.name
        }
        await this.profilesService.newProfile(result)
        await this.config.save()
    }

    ////// PROFILE EDITING (context menu) //////
    onProfileContextMenu (event: MouseEvent, profile: PartialProfile<Profile>): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuGroup = null
        this.contextMenuProfile = profile
        this.contextMenuRoot = false
        this.contextMenuMode = 'menu'
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
        this.menuPositionDirty = true
    }

    ////// ICON PICKER (context menu) //////
    openIconPicker (): void {
        this.contextMenuMode = 'icon'
        this.iconQuery = ''
        this.iconMatches = []
        this.showCustomSvgInput = false
        this.customSvgText = ''
        this.customSvgError = null
        this.customSvgWarning = null
        this.menuPositionDirty = true
    }

    get recentIcons (): string[] {
        return this.config.store.sidebarPlus?.recentIcons ?? []
    }

    ////// ICON FAVORITES //////
    // Permanent counterpart to recentIcons: an entry stays until explicitly
    // unpinned, where "Récentes" is a usage trail that evicts its oldest entry
    // past MAX_RECENT_ICONS. Not workspace-scoped — an icon is a rendering
    // choice, not part of what a workspace shows or hides.
    get favoriteIcons (): string[] {
        return this.config.store.sidebarPlus?.favoriteIcons ?? []
    }

    isFavoriteIcon (icon: string): boolean {
        return this.favoriteIcons.includes(icon)
    }

    /**
     * Right-click on an icon tile. Deliberately NOT routed through
     * contextMenuMode like every other menu in this component: those modes are
     * mutually exclusive, so switching to one would unmount the picker the
     * menu is supposed to act upon. This small menu therefore has its own
     * open-state and its own coordinates — sharing contextMenuX/Y would move
     * the picker itself, which is positioned from them.
     */
    onIconContextMenu (event: MouseEvent, icon: string): void {
        event.preventDefault()
        event.stopPropagation()
        this.iconMenuIcon = icon
        this.iconMenuX = event.clientX
        this.iconMenuY = event.clientY
        this.iconMenuPositionDirty = true
    }

    closeIconMenu (): void {
        this.iconMenuIcon = null
    }

    toggleFavoriteIconFromMenu (event: Event): void {
        if (this.iconMenuIcon) {
            this.toggleFavoriteIcon(this.iconMenuIcon, event)
        }
        this.closeIconMenu()
    }

    toggleFavoriteIcon (icon: string, event: Event): void {
        event.preventDefault()
        event.stopPropagation()
        this.config.store.sidebarPlus ??= {}
        const favorites: string[] = [...this.favoriteIcons]
        const index = favorites.indexOf(icon)
        if (index === -1) {
            favorites.push(icon)
        } else {
            favorites.splice(index, 1)
        }
        // Explicit reassignment, like every other write in this file — a
        // nested in-place mutation is never picked up as a change to persist
        // (piège #23).
        this.config.store.sidebarPlus.favoriteIcons = favorites
        this.config.save()
    }

    onIconQueryChange (): void {
        const q = this.iconQuery.trim().toLowerCase()
        this.iconMatches = q ? ICON_ENTRIES.filter(e => e.name.includes(q)).slice(0, 40) : []
    }

    toggleCustomSvgInput (): void {
        this.showCustomSvgInput = !this.showCustomSvgInput
    }

    async selectIconClass (iconClass: string): Promise<void> {
        await this.applyIcon(iconClass)
    }

    async applyCustomSvg (): Promise<void> {
        const result = sanitizeSvgIcon(this.customSvgText)
        if (!result.ok || !result.svg) {
            this.customSvgError = result.error ?? 'SVG rejeté.'
            this.customSvgWarning = null
            return
        }
        this.customSvgError = null
        this.customSvgWarning = result.warning ?? null
        await this.applyIcon(result.svg)
    }

    private async applyIcon (icon: string): Promise<void> {
        if (this.contextMenuProfile) {
            const profile = this.contextMenuProfile
            profile.icon = icon
            await this.profilesService.writeProfile(profile)
        } else if (this.contextMenuGroup) {
            // Only ever pass a minimal {id, icon} object here, never
            // contextMenuGroup itself — it carries the plugin-computed
            // `.children`/`.collapsed` fields, and writeProfileGroup()
            // Object.assign()s whatever it's given onto the live config
            // object (see roadmap piège #12: that's exactly how a past bug
            // leaked computed fields into config.yaml).
            await this.profilesService.writeProfileGroup({ id: this.contextMenuGroup.id, icon } as PartialProfileGroup<ProfileGroup>)
        } else {
            return
        }
        this.recordRecentIcon(icon)
        await this.config.save()
        this.closeContextMenu()
    }

    private recordRecentIcon (icon: string): void {
        this.config.store.sidebarPlus ??= {}
        const recent: string[] = (this.config.store.sidebarPlus.recentIcons ?? []).filter((i: string) => i !== icon)
        recent.unshift(icon)
        this.config.store.sidebarPlus.recentIcons = recent.slice(0, SidebarPlusTreeComponent.MAX_RECENT_ICONS)
    }

    /**
     * There is no public API to open the profile edit modal directly (it's
     * EditProfileModalComponent, marked @hidden and not exported by
     * tabby-settings — same situation as the native profile-tree component).
     * Falls back to: open Settings > Profiles (SettingsTabComponent IS
     * exported, takes an `activeTab` input for this), then drive the native
     * DOM to expand every collapsed group and click the target profile's
     * row directly — which is what actually opens the native edit modal
     * (there's no separate "Edit" button; the dropdown only has
     * Duplicate/Hide/Delete). If we're the ones who opened a brand-new
     * Settings tab for this (as opposed to reusing one the user already had
     * open), automatically close it and return to the previous tab once the
     * modal closes, with a toast confirming. This last part depends on
     * tabby-settings' internal, unversioned DOM structure — see roadmap
     * "Points fragiles à revérifier après une mise à jour de Tabby".
     */
    async openProfileSettings (profile?: PartialProfile<Profile>): Promise<void> {
        const previousTab = this.app.activeTab
        const existingSettingsTab = this.app.tabs.find(t => t instanceof SettingsTabComponent) as SettingsTabComponent|undefined
        let settingsTab: BaseTabComponent
        let weOpenedTab = false
        if (existingSettingsTab) {
            existingSettingsTab.activeTab = 'profiles'
            this.app.selectTab(existingSettingsTab)
            settingsTab = existingSettingsTab
        } else {
            settingsTab = this.app.openNewTabRaw({ type: SettingsTabComponent, inputs: { activeTab: 'profiles' } })
            weOpenedTab = true
        }
        this.closeContextMenu()

        if (!profile) {
            return
        }
        const modalOpened = await this.clickNativeProfileRow(profile.name)
        if (modalOpened && weOpenedTab) {
            this.watchForNativeModalClose(settingsTab, previousTab)
        }
    }

    /** Expands every collapsed group in the native profiles list (`fa-folder` = collapsed, `fa-folder-open` = expanded), then clicks the target profile's row. Returns whether the edit modal actually opened. */
    private async clickNativeProfileRow (profileName: string): Promise<boolean> {
        await this.wait(400)

        for (let pass = 0; pass < 10; pass++) {
            const collapsed = Array.from(document.querySelectorAll<HTMLElement>('.collapse-item'))
                .filter(row => row.querySelector('.fa-folder:not(.fa-folder-open)'))
            if (!collapsed.length) {
                break
            }
            collapsed.forEach(row => row.click())
            await this.wait(150)
        }

        const row = Array.from(document.querySelectorAll<HTMLElement>('.collapse-item'))
            .find(r => r.querySelector('span')?.textContent?.trim() === profileName)
        row?.click()
        if (!row) {
            return false
        }
        await this.wait(300)
        return !!document.querySelector('.modal-content')
    }

    /** Polls for the native edit modal to close, then closes the Settings tab we opened and returns to the previously active one. */
    private watchForNativeModalClose (settingsTab: BaseTabComponent, previousTab: BaseTabComponent|null): void {
        if (this.modalWatchInterval) {
            clearInterval(this.modalWatchInterval)
        }
        let sawModal = false
        let elapsedMs = 0
        this.modalWatchInterval = setInterval(() => {
            elapsedMs += 300
            const modalPresent = !!document.querySelector('.modal-content')
            if (modalPresent) {
                sawModal = true
                return
            }
            if (sawModal || elapsedMs > 10 * 60 * 1000) {
                if (this.modalWatchInterval) {
                    clearInterval(this.modalWatchInterval)
                    this.modalWatchInterval = null
                }
                if (!sawModal) {
                    return
                }
                this.app.closeTab(settingsTab)
                if (previousTab) {
                    this.app.selectTab(previousTab)
                }
                this.notifications.notice('Retour à votre session précédente')
            }
        }, 300)
    }

    private wait (ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    async deleteGroup (group: PartialProfileGroup<CollapsableProfileGroup>): Promise<void> {
        const childCount = group.children?.length ?? 0
        const profileCount = group.profiles?.length ?? 0
        if (childCount || profileCount) {
            const reasons: string[] = []
            if (childCount) {
                reasons.push(`${childCount} sous-dossier${childCount > 1 ? 's' : ''}`)
            }
            if (profileCount) {
                reasons.push(`${profileCount} profil${profileCount > 1 ? 's' : ''}`)
            }
            this.notifications.error(
                `Impossible de supprimer "${group.name}"`,
                `Ce dossier contient encore ${reasons.join(' et ')}. Videz-le d'abord.`,
            )
            this.closeContextMenu()
            return
        }
        await this.profilesService.deleteProfileGroup(group)
        this.config.save()
        this.closeContextMenu()
    }

    ////// PROFILE DELETION (context menu) //////
    confirmDeleteProfile (): void {
        this.contextMenuMode = 'confirmDeleteProfile'
        this.menuPositionDirty = true
    }

    async deleteProfile (profile: PartialProfile<Profile>): Promise<void> {
        await this.profilesService.deleteProfile(profile)
        await this.config.save()
        this.closeContextMenu()
    }
}
