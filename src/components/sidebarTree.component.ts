import './sidebarTree.component.scss'
import FuzzySearch from 'fuzzy-search'
import { merge, Subscription, timer } from 'rxjs'
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop'
import { AfterViewChecked, Component, ElementRef, HostBinding, HostListener, Inject, Input, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import {
    AppService,
    BaseTabComponent,
    ConfigService,
    HotkeysService,
    NotificationsService,
    PartialProfile,
    PlatformService,
    PartialProfileGroup,
    Profile,
    ProfileGroup,
    ProfileProvider,
    ProfilesService,
    SplitTabComponent,
} from 'tabby-core'
import { EditProfileModalComponent, SettingsTabComponent } from 'tabby-settings'
import { ForwardedPortConfig, PortForwardType, SSHTabComponent } from 'tabby-ssh'
import { loadIconEntries, PickerIcon } from '../icons'
import { sanitizeSvgIcon } from '../svgSanitizer'
import { SidebarWorkspace } from '../configProvider'
import { FOCUS_FILTER_HOTKEY } from '../hotkeys'
import { PingState, SidebarPlusPingService } from '../ping.service'
import { focusTab, getAllOpenTabs, isLiveSSHTab, isSSHTab } from '../tabs'
import { clampInViewport } from '../viewport'

interface CollapsableProfileGroup extends ProfileGroup {
    collapsed: boolean
    children: PartialProfileGroup<CollapsableProfileGroup>[]
}

type ProfileConnectionStatus = 'connected' | 'error'

/** Duck-typed shape of tabs that carry a launching profile and a live session (e.g. BaseTerminalTabComponent). */
interface ProfileBackedTab {
    profile?: { id?: string, name?: string, icon?: string, color?: string }
    session?: unknown
}

/**
 * The tunnel form's working copy. Ports are nullable here where
 * `ForwardedPortConfig` types them as `number`: a numeric input bound to 0
 * renders a literal "0" the user has to clear before typing, so the draft
 * starts empty and only becomes a ForwardedPortConfig once validated.
 */
interface TunnelDraft {
    type: PortForwardType
    host: string
    port: number|null
    targetAddress: string
    targetPort: number|null
    description: string
}

/** One row of the "Tunnels actifs" section — a single live port forward, tied back to the session carrying it. */
interface ActiveTunnel {
    tab: SSHTabComponent
    /** Owning session's display name, so a tunnel can be read without cross-referencing the sessions list. */
    sessionName: string
    /** What the row shows: the user's own description when there is one, since that is what they named it for. */
    label: string
    /** Technical form (`L 127.0.0.1:8181 → localhost:8181`), revealed on click rather than shown by default. */
    detail: string
    /** Browsable address, for a Local forward only — Remote listens on the far end, Dynamic is a SOCKS proxy with no page to open. */
    url: string|null
}

/** One row of the "Sessions actives" section — a live SSH tab, flattened out of its split if it is in one. */
interface ActiveSession {
    tab: SSHTabComponent
    /** The tab's manual rename if it has one, else the launching profile's name, else the tab's own title (quick connect, opened outside any saved profile). */
    name: string
    icon: string
    color: string|null
    /** The tab's live title (usually `user@host: cwd`), shown as a tooltip since it moves around too much to be the label. */
    title: string
    focused: boolean
}

@Component({
    selector: 'sidebar-plus-tree',
    template: require('./sidebarTree.component.pug'),
})
export class SidebarPlusTreeComponent implements OnInit, OnDestroy, AfterViewChecked {
    profileGroups: PartialProfileGroup<ProfileGroup>[] = []
    rootGroups: PartialProfileGroup<ProfileGroup>[] = []

    @Input() filter = ''

    /**
     * The filter field itself, so the hotkey can put the cursor in it.
     *
     * Optional on purpose: it lives under `*ngIf='!sftpMode'`, so it is simply
     * absent while the sidebar shows the SFTP view.
     */
    @ViewChild('filterInput') filterInput?: ElementRef<HTMLInputElement>
    private hotkeySubscription: Subscription|null = null

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
     * **Never restored across restarts**, by explicit user request
     * (2026-08-01): the sidebar always comes back on Profils. The SFTP view
     * only makes sense next to the session it was opened for, and that session
     * is gone after a restart — landing in it meant switching back by hand
     * every single time. The toggle stays session-local state, held in this
     * field alone.
     */
    sftpMode = false

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

    ////// ACTIVE SESSIONS //////
    /**
     * The live SSH sessions listed at the top of the sidebar, rebuilt by the
     * same pass that refreshes the connection dots. Deliberately *not*
     * filtered by the active workspace: unlike visibility, favorites and
     * order, an open session is a fact about the app, not about the workspace
     * you happen to be looking at — hiding one you have open would be a way to
     * lose track of it.
     */
    activeSessions: ActiveSession[] = []
    /** tab → when it was first seen live, the only record of a session's age there is (see sessionUptime()). */
    private sessionOpenedAt = new Map<SSHTabComponent, number>()
    /** The row under the pointer and the tooltip text held still for it — see sessionTooltip(). */
    private hoveredSessionTab: SSHTabComponent|null = null
    private hoveredSessionTooltip = ''
    /** Per-machine UI state (localStorage, like sftpMode) rather than a `sidebarPlus.*` config key — nothing worth syncing across machines, and it sidesteps piège #16 entirely. */
    activeSessionsCollapsed = window.localStorage.sidebarPlusActiveSessionsCollapsed === 'true'

    ////// SSH TUNNELS //////
    /**
     * Live port forwards, flattened across every open SSH session, and the
     * per-profile count backing the badge in the tree. Both are rebuilt by the
     * same pass that refreshes the active sessions — Tabby emits nothing when a
     * forward is added or removed, so this rides the existing 2s poll rather
     * than introducing a second one.
     */
    activeTunnels: ActiveTunnel[] = []
    tunnelCounts = new Map<string, number>()
    /**
     * profileId → signatures of the forwards actually mounted on its live
     * session. Lets the config popup tell a tunnel Tabby is really running from
     * one merely written down — only the former resists deletion.
     */
    private liveTunnelKeys = new Map<string, Set<string>>()
    activeTunnelsCollapsed = window.localStorage.sidebarPlusActiveTunnelsCollapsed === 'true'

    /** The profile whose configured tunnels the popup is editing, and its working copy. */
    tunnelDraft: TunnelDraft = SidebarPlusTreeComponent.emptyTunnel()
    tunnelError: string|null = null
    /** Index of the tunnel the form is editing, or null when it is adding a new one. */
    editingTunnelIndex: number|null = null

    profileStatuses = new Map<string, ProfileConnectionStatus>()
    private statusSubscription: Subscription|null = null
    private configSubscription: Subscription|null = null
    /** Focus moves *between panes* of the active split emit nothing on AppService — see watchSplitFocus(). */
    private splitFocusSubscription: Subscription|null = null

    contextMenuGroup: PartialProfileGroup<CollapsableProfileGroup>|null = null
    contextMenuProfile: PartialProfile<Profile>|null = null
    contextMenuRoot = false
    contextMenuX = 0
    contextMenuY = 0
    contextMenuMode:
        'menu'|'icon'|'createGroup'|'createProfile'|'confirmDeleteProfile'|'rename'|'tunnels'|
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

    // One getter per value of `contextMenuMode`, so the template never has to
    // spell the string out.
    //
    // The escaping this was once thought to work around is real but harmless:
    // pug does serialize `contextMenuMode === "icon"` as
    // `contextMenuMode === &quot;icon&quot;` in the compiled template, and
    // Angular decodes the entities before parsing the expression. Verified by
    // compiling this very template — sixteen bindings elsewhere in it rely on
    // quoted literals and work (`activeWorkspaceId === "all"`,
    // `group.icon ?? "far fa-folder"`, and the connection status dot among
    // them). So these getters are a readability choice, not a workaround: a
    // new mode does not *have* to get one.
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

    get isTunnelsMode (): boolean {
        return this.contextMenuMode === 'tunnels'
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
        private zone: NgZone,
        private platform: PlatformService,
        private hotkeys: HotkeysService,
        private ping: SidebarPlusPingService,
        @Inject(ProfileProvider) private profileProviders: ProfileProvider<Profile>[],
    ) { }

    async ngOnInit (): Promise<void> {
        await this.loadTreeItems()
        // Kept so ngOnDestroy can drop it. The component *is* destroyed —
        // SidebarPlusMountService unmounts it when `sidebarPlus.enabled` goes
        // false — and an orphaned subscription here means a dead component
        // still rebuilding the whole tree on every config.save() of the
        // application, twice cloned, for as long as the window lives.
        this.configSubscription = this.config.changed$.subscribe(() => this.loadTreeItems())

        // hotkey$, not unfilteredHotkey$: the filtered stream stays quiet while
        // a text field holds the focus, which is what keeps this from firing
        // while the user is typing in the filter field it would focus.
        this.hotkeySubscription = this.hotkeys.hotkey$.subscribe(id => {
            if (id === FOCUS_FILTER_HOTKEY) {
                this.focusFilter()
            }
        })

        this.refreshProfileStatuses()
        this.refreshActiveSessions()
        this.watchSplitFocus()
        this.statusSubscription = merge(
            this.app.tabsChanged$,
            this.app.tabOpened$,
            this.app.tabClosed$,
            this.app.tabRemoved$,
            // Drives the "focused" highlight of the active sessions list. The
            // periodic timer below would eventually catch up, but a highlight
            // trailing the user's own tab switch by up to two seconds reads as
            // a bug.
            this.app.activeTabChange$,
            // Nothing emits when a session merely *dies* (server-side drop,
            // network loss): the tab lives on showing "Reconnecter" while
            // `sshSession.open` has already flipped. Hence the poll — it is
            // what keeps a dead session from staying listed as live.
            timer(2000, 2000),
        ).subscribe(() => {
            this.refreshProfileStatuses()
            this.refreshActiveSessions()
            this.watchSplitFocus()
        })
    }

    ngOnDestroy (): void {
        this.statusSubscription?.unsubscribe()
        this.configSubscription?.unsubscribe()
        this.hotkeySubscription?.unsubscribe()
        this.splitFocusSubscription?.unsubscribe()
        if (this.selectionNoticeTimer) {
            clearTimeout(this.selectionNoticeTimer)
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

    /**
     * Puts the cursor in the filter field, selecting whatever is already in it
     * so a second search overwrites the first instead of appending to it.
     *
     * Switches back to the profile tree first when the sidebar is showing SFTP:
     * the field does not exist in that view, and doing nothing at all would
     * make the hotkey look broken. The focus is deferred one turn because the
     * field is only rendered on the change detection pass that follows.
     */
    focusFilter (): void {
        this.zone.run(() => {
            this.sftpMode = false
            this.showHiddenPanel = false
        })
        setTimeout(() => {
            const input = this.filterInput?.nativeElement
            input?.focus()
            input?.select()
        })
    }

    /**
     * Whether the tree currently shows search results rather than itself.
     *
     * Drag and drop is switched off while it does, and that is a fix, not a
     * restriction: the results are a flat rearrangement of the real tree, so
     * dropping inside them writes an order nobody asked for. On "Tous" it goes
     * straight to the profiles' native `weight` — the search order becoming the
     * real order — and inside a workspace it files a `profileOrder` under the
     * fake `search` group id, which nothing ever reads again.
     */
    get filtering (): boolean {
        return this.filter.trim().length > 0
    }

    /** `Échap` in the field: drop the filter and hand the focus back, rather than leave a filter nobody can see the cause of. */
    clearFilter (): void {
        this.filter = ''
        this.filterInput?.nativeElement.blur()
        void this.onFilterChange()
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
        //
        // `options.host`/`options.user` alongside the name: fuzzy-search walks
        // a dotted key, and a server one only remembers by address would
        // otherwise be unreachable from here. Absent on a non-SSH profile,
        // which the search simply skips.
        const matches = new FuzzySearch(
            profiles.filter(p => !p.isTemplate),
            ['name', 'description', 'options.host', 'options.user'],
            { sort: false },
        ).search(q)

        this.rootGroups = [
            ...this.matchingGroups(q),
            {
                id: 'search',
                editable: false,
                name: 'Filter results',
                icon: 'fas fa-magnifying-glass',
                profiles: matches,
            },
        ]
    }

    /**
     * Folders whose own name matches, rendered above the profile results with
     * their contents — searching for a folder and being shown only the profiles
     * inside it was the gap here.
     *
     * Built from `rawGroupsSnapshot` for the same reason the profile search
     * uses the full profile list: a workspace hides things from the tree, it
     * does not make them unfindable. Collapsed state is forced open, since a
     * folder returned by a search that renders shut says nothing at all.
     */
    private matchingGroups (q: string): PartialProfileGroup<ProfileGroup>[] {
        const matches = new FuzzySearch(this.rawGroupsSnapshot, ['name'], { sort: false }).search(q)
        if (!matches.length) {
            return []
        }
        // `buildGroupTree` over the *whole* snapshot, then pick the matching
        // nodes out of the result: run over the matches alone, it would drop
        // the children of a matching folder whose parent did not match.
        const tree = this.profilesService.buildGroupTree(
            structuredClone(this.rawGroupsSnapshot).map(g => SidebarPlusTreeComponent.intoCollapsable(g, false)),
        )
        const matchedIds = new Set(matches.map(g => g.id))
        const found: PartialProfileGroup<ProfileGroup>[] = []
        const walk = (groups: PartialProfileGroup<ProfileGroup>[]): void => {
            for (const group of groups) {
                if (matchedIds.has(group.id)) {
                    found.push(group)
                    // No recursion into a folder already returned: its subtree
                    // is rendered under it, and listing a matching child a
                    // second time at top level would show it twice.
                    continue
                }
                walk((group as PartialProfileGroup<CollapsableProfileGroup>).children ?? [])
            }
        }
        walk(tree)
        return found
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
    /** Same pair for profile rows, driving multi-selection reorder placement — see updateHoveredProfile(). */
    private draggedProfileId: string|null = null
    private hoveredProfileId: string|null = null

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
        if (this.draggedProfileId) {
            this.updateHoveredProfile(event.clientX, event.clientY)
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

    /**
     * Group ids that name a view, not a folder.
     *
     * Their rows live in real folders elsewhere — "Épinglés" gathers pinned
     * profiles from anywhere, the search group flattens the whole tree — so
     * their displayed order describes nothing that can be written back.
     * `ungrouped` is deliberately absent: it really is where profiles with no
     * group live, and its order is theirs.
     */
    private static readonly SYNTHETIC_GROUP_IDS = ['favorites', 'search']

    private static isSyntheticGroupId (groupId: string): boolean {
        return SidebarPlusTreeComponent.SYNTHETIC_GROUP_IDS.includes(groupId)
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
        for (const tab of getAllOpenTabs(this.app) as unknown as ProfileBackedTab[]) {
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

    ////// ACTIVE SESSIONS //////
    /**
     * Rebuilds the list of live SSH sessions, one row per *pane* — a split
     * holding three sessions is three rows, since focusing "the tab" would be
     * ambiguous otherwise.
     *
     * Only SSH tabs are listed, per the roadmap. Widening this to local/serial
     * tabs later is a matter of relaxing the `instanceof` and reading liveness
     * off `session` instead of `sshSession`.
     */
    private refreshActiveSessions (): void {
        const focused = this.resolveFocusedTab()
        const sessions: ActiveSession[] = []
        const tunnels: ActiveTunnel[] = []
        const tunnelCounts = new Map<string, number>()
        const liveTunnelKeys = new Map<string, Set<string>>()
        for (const tab of getAllOpenTabs(this.app)) {
            // Same narrowing as the SFTP panel, through the same helper: it
            // only holds while `tabby-ssh` stays out of node_modules
            // (src/types/tabby-ssh/PROVENANCE.md, piège #34), and isSSHTab()
            // is where that assumption is checked rather than assumed.
            if (!isSSHTab(tab)) {
                continue
            }
            // Both halves of the test matter — see isLiveSSHTab and piège #37.
            // Shared with the SFTP panel since 2026-08-02: the two had drifted
            // apart, this list dropping a session the panel went on serving.
            if (!isLiveSSHTab(tab)) {
                continue
            }
            const profile = (tab as unknown as ProfileBackedTab).profile
            // A manually renamed tab wins over the profile name: with several
            // sessions open on the same machine the profile name repeats on
            // every row, and the rename is the user's own way of telling them
            // apart. Same precedence as Tabby's own tab header, which renders
            // `customTitle || title`.
            //
            // The rename modal only ever targets the *top-level* tab (both
            // entry points — `tabHeader`'s dblclick and the tab context menu —
            // pass `this.tab`), so for a pane inside a split the custom title
            // lives on the SplitTabComponent and never on the pane itself:
            // hence the `topmostParent` fallback. Consequence to keep in mind:
            // two SSH panes sharing a renamed split show the same label, which
            // is exactly what their tab header shows.
            const renamedTitle = tab.customTitle || tab.topmostParent?.customTitle
            const sessionName = renamedTitle || profile?.name || tab.title || 'Session SSH'
            sessions.push({
                tab,
                name: sessionName,
                icon: profile?.icon || tab.icon || 'fas fa-terminal',
                color: profile?.color ?? tab.color ?? null,
                title: tab.title,
                focused: tab === focused,
            })

            // Read straight off the live transport. Tabby owns the forwarding
            // engine entirely — this plugin only mirrors its state, per the
            // roadmap's "surcouche visuelle" framing.
            for (const forward of tab.sshSession.forwardedPorts ?? []) {
                const detail = SidebarPlusTreeComponent.formatTunnel(forward)
                tunnels.push({
                    tab,
                    sessionName,
                    label: forward.description?.trim() || detail,
                    detail,
                    url: SidebarPlusTreeComponent.tunnelUrl(forward),
                })
                if (profile?.id) {
                    tunnelCounts.set(profile.id, (tunnelCounts.get(profile.id) ?? 0) + 1)
                    const keys = liveTunnelKeys.get(profile.id) ?? new Set<string>()
                    keys.add(SidebarPlusTreeComponent.tunnelKey(forward))
                    liveTunnelKeys.set(profile.id, keys)
                }
            }
        }
        // Same guard as the sessions list above, and for the same reason: this
        // runs every 2s and *ngFor tracks by object identity, so reassigning
        // unconditionally would rebuild every row twice a second and drop the
        // :hover state the open-in-browser button lives in — it would blink out
        // from under the cursor and swallow the click.
        if (!SidebarPlusTreeComponent.sameTunnels(this.activeTunnels, tunnels)) {
            this.activeTunnels = tunnels
        }
        this.tunnelCounts = tunnelCounts
        this.liveTunnelKeys = liveTunnelKeys
        // Only swap the array in when something actually changed. This runs on
        // a 2s timer, and `*ngFor` tracks rows by object identity: reassigning
        // unconditionally would rebuild every row's DOM twice a second, which
        // drops the `:hover` state the `.actions` overlay depends on — the SFTP
        // button would blink out from under the cursor and swallow the click.
        if (!SidebarPlusTreeComponent.sameSessions(this.activeSessions, sessions)) {
            this.activeSessions = sessions
        }

        // Uptime is stamped here, on first sighting, and forgotten as soon as
        // the tab leaves the list — see sessionUptime() for what that implies.
        // Kept out of the ActiveSession rows for the same reason as the
        // latency: a value that changes every tick would fail sameSessions().
        const now = Date.now()
        const live = new Set(sessions.map(session => session.tab))
        for (const tab of this.sessionOpenedAt.keys()) {
            if (!live.has(tab)) {
                this.sessionOpenedAt.delete(tab)
            }
        }
        for (const tab of live) {
            if (!this.sessionOpenedAt.has(tab)) {
                this.sessionOpenedAt.set(tab, now)
            }
        }

        // Rides this same 2s pass rather than bringing its own timer; the
        // service decides which sessions are actually due a probe, and does
        // nothing at all while the interval is 0. Deliberately *not* part of
        // the ActiveSession rows above: a latency that changes every few
        // seconds would fail `sameSessions()` and rebuild every row's DOM,
        // dropping the `:hover` the action buttons live in. The template reads
        // it through pingState()/pingLabel() instead.
        this.ping.poll(sessions.map(session => session.tab))
    }

    /**
     * The colour of the row's one dot.
     *
     * There is no second dot for latency, on purpose: every row in this section
     * is a live session by construction, so a dot that was always green said
     * nothing at all. With the probe off it stays green — the state it has
     * always shown — and with it on, it says how fast the session answers.
     */
    sessionDotClass (session: ActiveSession): string {
        if (this.ping.intervalMs <= 0) {
            return 'status-dot-connected'
        }
        const state: PingState = this.ping.state(session.tab)
        if (state === 'good') {
            return 'status-dot-connected'
        }
        if (state === 'fair') {
            return 'status-dot-fair'
        }
        if (state === 'poor') {
            return 'status-dot-poor'
        }
        // 'unknown' (not measured yet) and 'unavailable' (no SFTP subsystem)
        // both fall through to the dimmed base style, which is the honest
        // rendering of "no figure to show".
        return ''
    }

    /**
     * The row's tooltip, carried by the whole row rather than by the dot: a 6px
     * dot is not something one aims at to read a figure (user request,
     * 2026-08-03).
     *
     * Form settled by the user the same day: `app.exemple.fr | 13 ms | 1m 47s`,
     * three fields and no prose. The tab's live title (`user@host: cwd`), which
     * this tooltip used to carry, is dropped with it — the row already shows
     * the name, and a title that moves with the working directory was the
     * verbose part. The latency field disappears entirely when there is no
     * figure, rather than showing a placeholder.
     */
    sessionTooltip (session: ActiveSession): string {
        // Frozen for as long as the pointer stays on the row. A native tooltip
        // is torn down and rebuilt whenever its `title` attribute is rewritten,
        // and this one would be rewritten on every 2s pass as the seconds move
        // — which read as a flicker while trying to read it. Off the row the
        // value keeps updating: nothing is on screen to flicker.
        if (this.hoveredSessionTab === session.tab) {
            return this.hoveredSessionTooltip
        }
        return this.buildSessionTooltip(session)
    }

    /**
     * Takes the snapshot the tooltip will show, and drops it on the way out.
     *
     * Consequence to accept: hover a row for two minutes and the figures are
     * those of the moment the pointer arrived. Leaving and coming back is what
     * refreshes them — and that is the gesture anyone makes to re-read a
     * tooltip anyway.
     */
    onSessionHover (session: ActiveSession, hovering: boolean): void {
        if (hovering) {
            this.hoveredSessionTab = session.tab
            this.hoveredSessionTooltip = this.buildSessionTooltip(session)
        } else if (this.hoveredSessionTab === session.tab) {
            this.hoveredSessionTab = null
        }
    }

    private buildSessionTooltip (session: ActiveSession): string {
        const latency = this.ping.latencyMs(session.tab)
        return [
            session.name,
            latency === null ? null : `${latency} ms`,
            SidebarPlusTreeComponent.formatUptimePrecise(this.uptimeMs(session)),
        ].filter(Boolean).join(' | ')
    }

    /**
     * How long the session has been up, stamped by this component the first
     * time the tab shows up in the list.
     *
     * Nothing in Tabby or `tabby-ssh` records when a session opened — checked
     * on the installed source — so it has to be observed. Two consequences,
     * both benign: a session that was already open when this component mounted
     * is dated from the mount (only reachable by disabling and re-enabling the
     * plugin, the sidebar being mounted at startup), and a session that drops
     * and reconnects restarts from zero, since it leaves the list in between.
     * The second one is arguably the right answer anyway.
     */
    sessionUptime (session: ActiveSession): string {
        const elapsed = this.uptimeMs(session)
        return elapsed === null ? '' : SidebarPlusTreeComponent.formatUptime(elapsed)
    }

    /** Milliseconds since the tab was first seen live, or null while it has not been stamped yet. */
    private uptimeMs (session: ActiveSession): number|null {
        const startedAt = this.sessionOpenedAt.get(session.tab)
        return startedAt === undefined ? null : Date.now() - startedAt
    }

    /**
     * `1m 47s`, `3h 05m`, `2j 04h` — the tooltip's own form, precise to the
     * second under a minute.
     *
     * Deliberately not the same rendering as the row's: this one is only read
     * while hovering, whereas the row is permanently in view, and seconds
     * ticking on every open session would keep the sidebar moving in the
     * corner of the eye for no gain.
     */
    private static formatUptimePrecise (ms: number|null): string {
        if (ms === null) {
            return ''
        }
        const seconds = Math.max(0, Math.floor(ms / 1000))
        if (seconds < 60) {
            return `${seconds}s`
        }
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) {
            return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
        }
        const hours = Math.floor(minutes / 60)
        if (hours < 24) {
            return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
        }
        return `${Math.floor(hours / 24)}j ${String(hours % 24).padStart(2, '0')}h`
    }

    /** `42 s`, `12 min`, `3 h 05`, `2 j 4 h` — coarser as it gets longer, since a session's age is read at a glance. */
    private static formatUptime (ms: number): string {
        const seconds = Math.max(0, Math.floor(ms / 1000))
        if (seconds < 60) {
            return `${seconds} s`
        }
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) {
            return `${minutes} min`
        }
        const hours = Math.floor(minutes / 60)
        if (hours < 24) {
            return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
        }
        return `${Math.floor(hours / 24)} j ${hours % 24} h`
    }

    private static sameSessions (a: ActiveSession[], b: ActiveSession[]): boolean {
        return a.length === b.length && a.every((session, i) =>
            session.tab === b[i].tab &&
            session.focused === b[i].focused &&
            session.name === b[i].name &&
            session.icon === b[i].icon &&
            session.color === b[i].color &&
            session.title === b[i].title)
    }

    /** The pane the user is actually looking at: `app.activeTab` is the split, not the session inside it. */
    private resolveFocusedTab (): BaseTabComponent|null {
        const active = this.app.activeTab
        return active instanceof SplitTabComponent ? active.getFocusedTab() : active
    }

    /**
     * Keeps the focused-row highlight in step with focus moves *inside* the
     * active split, which AppService knows nothing about. Re-subscribed on
     * every refresh: dropping the old subscription unconditionally is what
     * makes switching from one split to another actually follow the new one.
     */
    private watchSplitFocus (): void {
        this.splitFocusSubscription?.unsubscribe()
        this.splitFocusSubscription = null
        const active = this.app.activeTab
        if (active instanceof SplitTabComponent) {
            this.splitFocusSubscription = active.focusChanged$.subscribe(() => this.refreshActiveSessions())
        }
    }

    ////// SSH TUNNELS //////
    /**
     * Formatted here rather than through `ForwardedPort.toString()`: inheriting
     * a display helper from Tabby also inherits whatever it gets wrong, and a
     * wrong rendering raises no error (piège #35). The shapes follow ssh(1)'s
     * own -L/-R/-D notation, which is what anyone reading a tunnel list expects.
     */
    private static formatTunnel (forward: ForwardedPortConfig): string {
        if (forward.type === PortForwardType.Dynamic) {
            return `D ${forward.host}:${forward.port} (SOCKS)`
        }
        const arrow = forward.type === PortForwardType.Remote ? 'R' : 'L'
        return `${arrow} ${forward.host}:${forward.port} → ${forward.targetAddress}:${forward.targetPort}`
    }

    /**
     * Identity of a forward across the config/live boundary. The two sides are
     * different objects — the modal builds a fresh `ForwardedPort` from the
     * config values — so they can only be matched on what they describe.
     * `description` is left out: it is a label, editing it does not make it a
     * different tunnel.
     */
    private static tunnelKey (forward: ForwardedPortConfig): string {
        return [forward.type, forward.host, forward.port, forward.targetAddress, forward.targetPort].join('|')
    }

    /** Whether this configured tunnel is one Tabby currently has mounted — the only kind whose deletion is withheld. */
    isTunnelLive (forward: ForwardedPortConfig): boolean {
        const profileId = this.contextMenuProfile?.id
        if (!profileId) {
            return false
        }
        return this.liveTunnelKeys.get(profileId)?.has(SidebarPlusTreeComponent.tunnelKey(forward)) ?? false
    }

    private static sameTunnels (a: ActiveTunnel[], b: ActiveTunnel[]): boolean {
        return a.length === b.length && a.every((tunnel, i) =>
            tunnel.tab === b[i].tab &&
            tunnel.label === b[i].label &&
            tunnel.detail === b[i].detail &&
            tunnel.url === b[i].url &&
            tunnel.sessionName === b[i].sessionName)
    }

    /**
     * The address a Local forward can be opened at, or null.
     *
     * Only Local is browsable: Remote listens on the far end of the connection,
     * and Dynamic is a SOCKS proxy with no page behind it. `0.0.0.0` means
     * "every interface", which is not an address a browser can be pointed at —
     * loopback is the one that reaches it. https is inferred from the usual
     * ports only; guessing further would produce links that fail to load.
     */
    private static tunnelUrl (forward: ForwardedPortConfig): string|null {
        if (forward.type !== PortForwardType.Local) {
            return null
        }
        const host = !forward.host || forward.host === '0.0.0.0' ? '127.0.0.1' : forward.host
        const scheme = forward.port === 443 || forward.targetPort === 443 ? 'https' : 'http'
        return `${scheme}://${host}:${forward.port}`
    }

    openTunnelUrl (tunnel: ActiveTunnel, event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        if (tunnel.url) {
            this.platform.openExternal(tunnel.url)
        }
    }

    /** Which tunnel row has its technical details unfolded, by index — clicking a row toggles it. */
    expandedTunnelIndex: number|null = null

    toggleTunnelDetails (index: number, event: MouseEvent): void {
        event.preventDefault()
        this.expandedTunnelIndex = this.expandedTunnelIndex === index ? null : index
    }

    /** Backs the chain badge in the tree — number of live forwards across every open session of this profile. */
    tunnelCount (profile: PartialProfile<Profile>): number {
        return (profile.id && this.tunnelCounts.get(profile.id)) || 0
    }

    /**
     * Tunnels written on the profile, mounted or not. Drives a dimmed badge so
     * a profile carrying forwards is recognisable before it is launched —
     * otherwise they only ever appear once connected, which is precisely when
     * a surprise is least welcome.
     */
    configuredTunnelCount (profile: PartialProfile<Profile>): number {
        return (profile.options as { forwardedPorts?: ForwardedPortConfig[] }|undefined)?.forwardedPorts?.length ?? 0
    }

    toggleActiveTunnels (): void {
        this.activeTunnelsCollapsed = !this.activeTunnelsCollapsed
        window.localStorage.sidebarPlusActiveTunnelsCollapsed = this.activeTunnelsCollapsed
    }

    /** stopPropagation, not just preventDefault: the row itself is a click target now (it folds the details open), and without this the button did both. */
    focusTunnelSession (tunnel: ActiveTunnel, event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        focusTab(this.app, tunnel.tab)
    }

    /**
     * The live SSH tab of a profile, if one is connected — decides which of the
     * two tunnel entries the profile menu offers.
     */
    private connectedTabForProfile (profile: PartialProfile<Profile>): SSHTabComponent|null {
        if (!profile.id) {
            return null
        }
        for (const tab of getAllOpenTabs(this.app)) {
            if (!isSSHTab(tab)) {
                continue
            }
            const backing = tab as unknown as ProfileBackedTab
            if (backing.profile?.id === profile.id && tab.sshSession?.open && backing.session) {
                return tab
            }
        }
        return null
    }

    ////// PROFILE TUNNEL CONFIGURATION (popup) //////
    /**
     * The plugin's own tunnel editor, and — by the user's explicit choice —
     * the only one. An entry handing over to Tabby's native
     * `showPortForwarding()` modal was built and validated alongside it, then
     * dropped: "je veux uniquement ma solution maison".
     *
     * What that settles, so it is not rediscovered as a bug: nothing here can
     * touch a session that is already running. Everything written goes to the
     * profile's configuration, which Tabby reads only when a session starts.
     * Acting on a live session would mean calling
     * `SSHSession.addPortForward()`, which calls `fw.startLocalListener()` and
     * therefore needs a genuine `ForwardedPort` — a class tabby-ssh does not
     * export at runtime (checked against the installed bundle, piège #13).
     * Rebuilding one from an existing forward's prototype would only work once
     * the user already had a tunnel, which is circular.
     */
    private static emptyTunnel (): TunnelDraft {
        return {
            type: PortForwardType.Local,
            // Hosts keep a sensible default — they are almost always these —
            // while both ports start empty rather than at 0, which would have
            // to be cleared by hand before typing.
            host: '127.0.0.1',
            port: null,
            targetAddress: 'localhost',
            targetPort: null,
            description: '',
        }
    }

    /** Port forwarding is an SSH-profile notion — the menu entries stay hidden on local/serial/telnet profiles rather than offering a setting Tabby would ignore. */
    get isSshProfileMenu (): boolean {
        return this.contextMenuProfile?.type === 'ssh'
    }

    /** Tunnels stored on the profile itself. Empty for a non-SSH profile, which simply has no such option. */
    get profileTunnels (): ForwardedPortConfig[] {
        return (this.contextMenuProfile?.options as { forwardedPorts?: ForwardedPortConfig[] }|undefined)?.forwardedPorts ?? []
    }

    /**
     * Whether the profile this popup is editing has a live session.
     *
     * Everything written here lands in the profile's configuration and is only
     * read when a session starts, so on a running session: added and edited
     * tunnels stay dormant until relaunch, and deleting one would remove the
     * configuration while the forward Tabby already mounted keeps running —
     * the user would believe it gone. Deletion of a *mounted* tunnel is
     * therefore withheld until the session is closed; see isTunnelLive(), which
     * is what narrows that rule to the forwards actually running.
     */
    get hasLiveSessionForMenuProfile (): boolean {
        return !!this.contextMenuProfile && !!this.connectedTabForProfile(this.contextMenuProfile)
    }

    get tunnelTypes (): PortForwardType[] {
        return [PortForwardType.Local, PortForwardType.Remote, PortForwardType.Dynamic]
    }

    formatTunnelRow (forward: ForwardedPortConfig): string {
        return SidebarPlusTreeComponent.formatTunnel(forward)
    }

    openProfileTunnels (): void {
        this.tunnelDraft = SidebarPlusTreeComponent.emptyTunnel()
        this.tunnelError = null
        this.editingTunnelIndex = null
        this.contextMenuMode = 'tunnels'
        this.menuPositionDirty = true
    }

    /**
     * Loads an existing tunnel back into the form (double-click on its row).
     * Ports come back as null when zero so the field reads empty rather than
     * "0" — same reason the draft keeps them nullable in the first place; a
     * Dynamic forward is stored with an empty destination, and editing one
     * should not show a phantom port.
     */
    startEditTunnel (index: number): void {
        const forward = this.profileTunnels[index]
        if (!forward) {
            return
        }
        this.tunnelDraft = {
            type: forward.type,
            host: forward.host,
            port: forward.port || null,
            targetAddress: forward.targetAddress || 'localhost',
            targetPort: forward.targetPort || null,
            description: forward.description ?? '',
        }
        this.editingTunnelIndex = index
        this.tunnelError = null
    }

    cancelEditTunnel (): void {
        this.tunnelDraft = SidebarPlusTreeComponent.emptyTunnel()
        this.editingTunnelIndex = null
        this.tunnelError = null
    }

    get isDynamicDraft (): boolean {
        return this.tunnelDraft.type === PortForwardType.Dynamic
    }

    /**
     * Which side of the connection each field refers to — it *inverts* between
     * Local and Remote, and the destination is always resolved from the far end
     * of the tunnel, so `localhost` means the server for a Local forward. Left
     * implicit, this is the kind of thing that gets a forward pointed at the
     * wrong machine on real infrastructure.
     */
    get tunnelHint (): string {
        if (this.tunnelDraft.type === PortForwardType.Remote) {
            return 'Écoute sur le serveur distant. La destination est résolue depuis votre PC.'
        }
        if (this.tunnelDraft.type === PortForwardType.Dynamic) {
            return 'Ouvre un proxy SOCKS sur votre PC, sans destination fixe.'
        }
        return 'Écoute sur votre PC. La destination est résolue depuis le serveur — « localhost » y désigne donc le serveur.'
    }

    async addProfileTunnel (): Promise<void> {
        const profile = this.contextMenuProfile
        if (!profile) {
            return
        }
        const draft = this.tunnelDraft
        if (!draft.port) {
            this.tunnelError = 'Indiquez un port d\'écoute.'
            return
        }
        if (!this.isDynamicDraft && (!draft.targetAddress || !draft.targetPort)) {
            this.tunnelError = 'Indiquez l\'hôte et le port de destination.'
            return
        }
        this.tunnelError = null

        // Dynamic forwards have no destination — Tabby still expects the fields
        // to exist, so they are written as empty/0 rather than left undefined.
        const forward: ForwardedPortConfig = {
            type: draft.type,
            host: draft.host,
            port: draft.port,
            targetAddress: this.isDynamicDraft ? '' : draft.targetAddress,
            targetPort: this.isDynamicDraft ? 0 : draft.targetPort!,
            description: draft.description,
        }

        const options = (profile.options ??= {}) as { forwardedPorts?: ForwardedPortConfig[] }
        // Reassigned rather than pushed into: writeProfile() replaces the
        // stored profile wholesale, so what matters is that `profile` carries
        // the final array — but a fresh array also keeps the rendered list from
        // sharing structure with the draft.
        const forwards = [...(options.forwardedPorts ?? [])]
        if (this.editingTunnelIndex !== null && forwards[this.editingTunnelIndex]) {
            forwards[this.editingTunnelIndex] = forward
        } else {
            forwards.push(forward)
        }
        options.forwardedPorts = forwards
        const wasEditing = this.editingTunnelIndex !== null
        await this.profilesService.writeProfile(profile)
        await this.config.save()
        this.tunnelDraft = SidebarPlusTreeComponent.emptyTunnel()
        this.editingTunnelIndex = null

        // Said once, when it actually matters, rather than as a banner sitting
        // permanently above the form: what is written here is configuration,
        // and Tabby only reads it when a session starts.
        //
        // info() rather than notice(): the latter hard-codes `timeOut: 1000` in
        // tabby-core, a second being far too short for a sentence explaining
        // *why* nothing seems to have happened. info() leaves ngx-toastr its
        // own timeout and splits the message into title and detail.
        if (this.hasLiveSessionForMenuProfile) {
            this.notifications.info(
                wasEditing ? 'Tunnel modifié' : 'Tunnel enregistré',
                wasEditing
                    ? 'La session en cours garde l\'ancien tant qu\'elle n\'est pas relancée.'
                    : 'Il sera monté au prochain lancement de cette session.',
            )
        }
    }

    async removeProfileTunnel (index: number): Promise<void> {
        const profile = this.contextMenuProfile
        if (!profile) {
            return
        }
        // Only a tunnel Tabby has actually mounted resists deletion: removing
        // its configuration would leave the forward running while the user
        // believes it gone. One merely written down — added since the session
        // started, or never launched — deletes freely. Guarded here as well as
        // in the template: the rule belongs with the data.
        const target = this.profileTunnels[index]
        if (target && this.isTunnelLive(target)) {
            this.tunnelError = 'Ce tunnel est monté sur la session en cours. Fermez la session pour pouvoir le supprimer.'
            return
        }
        const options = (profile.options ??= {}) as { forwardedPorts?: ForwardedPortConfig[] }
        const forwards = [...(options.forwardedPorts ?? [])]
        forwards.splice(index, 1)
        options.forwardedPorts = forwards
        // A pending edit is indexed into the list that just shifted: cancel it
        // if its target is gone, and follow the shift otherwise — saving
        // against a stale index would overwrite the wrong tunnel.
        if (this.editingTunnelIndex !== null) {
            if (this.editingTunnelIndex === index) {
                this.cancelEditTunnel()
            } else if (this.editingTunnelIndex > index) {
                this.editingTunnelIndex--
            }
        }
        await this.profilesService.writeProfile(profile)
        await this.config.save()
    }

    toggleActiveSessions (): void {
        this.activeSessionsCollapsed = !this.activeSessionsCollapsed
        window.localStorage.sidebarPlusActiveSessionsCollapsed = this.activeSessionsCollapsed
    }

    focusSession (session: ActiveSession, event?: MouseEvent): void {
        event?.preventDefault()
        focusTab(this.app, session.tab)
    }

    /** Jumps to the session *and* swaps the sidebar to its SFTP view — the panel follows the focused tab, so the order matters. */
    openSessionSftp (session: ActiveSession, event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        focusTab(this.app, session.tab)
        this.setSftpMode(true)
    }

    ////// MULTI-SELECTION (profiles only, never groups) //////
    /**
     * Ephemeral and never persisted — and deliberately a set of *ids* rather
     * than of profile objects. Every config.save() fires config.changed$ →
     * loadTreeItems(), which structuredClone()s the whole tree and hands back
     * brand-new profile objects; a set of references would therefore empty
     * itself silently the first time the user pinned a favorite mid-selection.
     */
    selectedProfileIds = new Set<string>()
    /** Where a Shift+click extends *from*. Carries its group id because extending only ever happens within one container — see extendSelectionTo(). */
    private selectionAnchor: { groupId: string, profileId: string }|null = null

    /**
     * Transient confirmation shown in the selection bar *after* the selection
     * itself is gone. Without it the bar vanishes the instant a move lands,
     * which reads as "did that do anything?" — the tree has already
     * re-rendered elsewhere, so nothing on screen acknowledges the action.
     */
    selectionNotice: string|null = null
    private selectionNoticeTimer: ReturnType<typeof setTimeout>|null = null

    get selectionActive (): boolean {
        return this.selectedProfileIds.size > 0
    }

    /**
     * Wrapped in zone.run() because every caller reaches this *after*
     * `await config.save()`, and that continuation does not resume inside
     * Angular's zone — the field was being set correctly and the view simply
     * never repainted, so the confirmation was invisible from the first
     * version (reported in manual testing: "pas de notification"). Tabby's own
     * `notifications.notice()` was unaffected, which is what made the failure
     * look selective.
     *
     * Running inside the zone also means the setTimeout below is Zone-patched,
     * so its expiry triggers a change detection pass of its own and the
     * confirmation disappears on time without further help.
     */
    private showSelectionNotice (text: string): void {
        this.zone.run(() => {
            this.selectionNotice = text
            if (this.selectionNoticeTimer) {
                clearTimeout(this.selectionNoticeTimer)
            }
            this.selectionNoticeTimer = setTimeout(() => {
                this.selectionNotice = null
                this.selectionNoticeTimer = null
            }, 3000)
        })
    }

    isProfileSelected (profile: PartialProfile<Profile>): boolean {
        return !!profile.id && this.selectedProfileIds.has(profile.id)
    }

    clearSelection (): void {
        if (!this.selectedProfileIds.size) {
            return
        }
        this.selectedProfileIds = new Set()
        this.selectionAnchor = null
    }

    /**
     * Left-click on a profile row, with the modifier semantics of any OS file
     * manager: a plain click selects that row alone, Ctrl/Cmd toggles one row
     * in or out, Shift extends from the anchor. Double-click still launches the
     * profile, so selecting costs nothing.
     *
     * The tick boxes this replaced were dropped at the user's request after
     * manual testing — the row highlight plus the selection bar carry the state
     * on their own, and the row contents no longer pay a permanent indent for a
     * control that was only visible on hover.
     *
     * preventDefault() because the row is an `<a href="#">` — without it every
     * click pushes a history entry.
     */
    onProfileClick (profile: PartialProfile<Profile>, group: PartialProfileGroup<ProfileGroup>, event: MouseEvent): void {
        event.preventDefault()
        if (!profile.id) {
            return
        }
        if (event.shiftKey) {
            this.extendSelectionTo(profile, group)
        } else if (event.ctrlKey || event.metaKey) {
            this.toggleProfileSelection(profile, group)
        } else if (this.selectedProfileIds.size === 1 && this.selectedProfileIds.has(profile.id)) {
            // Clicking the only selected row again clears it, so a selection
            // can always be undone with the same gesture that made it.
            this.clearSelection()
        } else {
            this.selectedProfileIds = new Set([profile.id])
            this.selectionAnchor = { groupId: group.id, profileId: profile.id }
        }
    }

    toggleProfileSelection (profile: PartialProfile<Profile>, group: PartialProfileGroup<ProfileGroup>): void {
        if (!profile.id) {
            return
        }
        // Reassigned rather than mutated in place: cheap here, and it keeps the
        // field honest for any future OnPush-style change detection.
        const selected = new Set(this.selectedProfileIds)
        if (selected.has(profile.id)) {
            selected.delete(profile.id)
        } else {
            selected.add(profile.id)
        }
        this.selectedProfileIds = selected
        this.selectionAnchor = { groupId: group.id, profileId: profile.id }
    }

    /**
     * Extends the selection **within the anchor's own container only**.
     * "Everything between A and B in display order" has no honest answer
     * across containers here: applyFavorites() prepends a synthetic "Épinglés"
     * group rendering the very same profile ids a second time, a collapsed
     * folder renders none of its rows at all, and the filter mode replaces the
     * whole tree with one synthetic 'search' group. Anchored in a different
     * group, this degrades to a plain toggle instead of guessing.
     */
    private extendSelectionTo (profile: PartialProfile<Profile>, group: PartialProfileGroup<ProfileGroup>): void {
        const anchor = this.selectionAnchor
        if (!anchor || anchor.groupId !== group.id) {
            this.toggleProfileSelection(profile, group)
            return
        }
        const profiles = group.profiles ?? []
        const from = profiles.findIndex(p => p.id === anchor.profileId)
        const to = profiles.findIndex(p => p.id === profile.id)
        if (from === -1 || to === -1) {
            this.toggleProfileSelection(profile, group)
            return
        }
        const selected = new Set(this.selectedProfileIds)
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
            const id = profiles[i].id
            if (id) {
                selected.add(id)
            }
        }
        this.selectedProfileIds = selected
        // Anchor left untouched on purpose: a second Shift+click should
        // re-extend from the same origin, not from the previous endpoint.
    }

    /** Whether "Déplacer la sélection ici" should show on this folder's menu — same target rule as onProfileDrop(). */
    canMoveSelectionTo (group: PartialProfileGroup<ProfileGroup>): boolean {
        return this.selectionActive && (!!group.editable || group.id === 'ungrouped')
    }

    /**
     * Moves every selected profile into `targetGroup` in one pass.
     *
     * The whole move is snapshotted *before* the first write. writeProfile()
     * only mutates config.store.profiles (verified in the installed bundle: it
     * never calls config.save()), so nothing here can fire config.changed$ and
     * swap this.profileGroups out from under the loop — but the order writes
     * below still have to be computed against the state as it was, and a single
     * config.save() at the very end keeps the whole batch atomic from the
     * config's point of view.
     */
    async moveSelectionToGroup (
        targetGroup: PartialProfileGroup<ProfileGroup>,
        insertAfterProfileId: string|null = null,
    ): Promise<void> {
        this.closeContextMenu()
        if (!this.canMoveSelectionTo(targetGroup)) {
            return
        }
        // Tabby stores "no group" as an absent `group`, not as the id of its
        // synthetic 'ungrouped' bucket — same mapping onProfileDrop() applies.
        const targetGroupValue = targetGroup.id === 'ungrouped' ? undefined : targetGroup.id

        const moves: { profile: PartialProfile<Profile>, sourceGroupId: string }[] = []
        for (const group of this.profileGroups) {
            if (group.id === targetGroup.id) {
                // Already where it is being sent: skip the write, and leave it
                // out of the moved set so the target order below keeps it in
                // place instead of shuffling it to the end.
                continue
            }
            for (const profile of group.profiles ?? []) {
                if (profile.id && this.selectedProfileIds.has(profile.id)) {
                    moves.push({ profile, sourceGroupId: group.id })
                }
            }
        }
        if (!moves.length) {
            this.clearSelection()
            return
        }

        for (const { profile } of moves) {
            profile.group = targetGroupValue
            await this.profilesService.writeProfile(profile)
        }

        // Re-persist every source's order without the profiles that left, then
        // the target's with them appended — mirrors what onProfileDrop() does
        // for its single profile. Skipping the sources would leave their ids
        // sitting in their former folder's order list indefinitely.
        const movedIds = new Set(moves.map(m => m.profile.id))
        for (const sourceGroupId of new Set(moves.map(m => m.sourceGroupId))) {
            const source = this.profileGroups.find(g => g.id === sourceGroupId)
            await this.persistProfileOrder(sourceGroupId, (source?.profiles ?? []).filter(p => !movedIds.has(p.id)))
        }
        const target = this.profileGroups.find(g => g.id === targetGroup.id)
        const remaining = (target?.profiles ?? []).filter(p => !movedIds.has(p.id))
        // Dropped straight onto the folder's own row (or moved from the context
        // menu, which has no drop point at all): the batch goes to the TOP.
        // Appending it instead buried the profiles under everything already
        // there, which reads as "nothing happened" on a well-filled folder.
        // Landing on a profile row keeps the same rule as an in-folder
        // reorder — the batch goes just below the row aimed at.
        let insertAt = 0
        if (insertAfterProfileId) {
            const anchorIndex = remaining.findIndex(p => p.id === insertAfterProfileId)
            if (anchorIndex !== -1) {
                insertAt = anchorIndex + 1
            }
        }
        const ordered = [...remaining]
        ordered.splice(insertAt, 0, ...moves.map(m => m.profile))
        await this.persistProfileOrder(targetGroup.id, ordered)

        await this.config.save()
        const where = targetGroup.name || 'Sans groupe'
        this.clearSelection()
        this.showSelectionNotice(
            moves.length > 1
                ? `${moves.length} profils déplacés vers « ${where} »`
                : `Profil déplacé vers « ${where} »`,
        )
    }

    /**
     * Starting a drag on a profile that is *not* part of the current selection
     * drops that selection, exactly as right-clicking outside it does. Without
     * this the user drags one row while three others stay ticked somewhere
     * above, with nothing on screen saying which of the two the drop will act
     * on — reported as confusing in manual testing.
     */
    onProfileDragStarted (profile: PartialProfile<Profile>): void {
        if (!this.isProfileSelected(profile)) {
            this.clearSelection()
        }
        this.draggedProfileId = profile.id ?? null
        this.hoveredProfileId = null
    }

    /**
     * Releases the tracking only — `hoveredProfileId` is deliberately kept, for
     * the same reason as onGroupDragEnded(): CDK emits `cdkDragEnded` *before*
     * `cdkDropListDropped` (piège #29), so clearing it here would wipe the value
     * a moment before the drop handler reads it.
     */
    onProfileDragEnded (): void {
        this.draggedProfileId = null
    }

    /**
     * True for the selected rows that are *not* the one under the cursor, while
     * a multi-selection drag is running: they are collapsed out of the list so
     * the whole batch visibly leaves together, instead of one row vanishing and
     * the rest sitting there as if they were staying put.
     *
     * Restoration is guaranteed by `cdkDragEnded`, which CDK emits even when a
     * drag is abandoned outside any drop list — so a cancelled drag puts every
     * row back rather than leaving them hidden.
     */
    isHiddenWhileDragging (profile: PartialProfile<Profile>): boolean {
        return !!this.draggedProfileId &&
            this.selectedProfileIds.size > 1 &&
            profile.id !== this.draggedProfileId &&
            this.isProfileSelected(profile)
    }

    /**
     * The profile row physically under the pointer, measured live.
     *
     * CDK's `currentIndex` turned out not to mean what the first version
     * assumed — a block reordered from it landed above the targeted row every
     * time, whichever direction the drag came from. Rather than reverse-engineer
     * its convention, the drop point is resolved the same way the folder rescue
     * already does it: by hit-testing the rendered rows. The drag placeholder is
     * height: 0 here (piège #28), so the rows do not shift during a drag and
     * what is measured is exactly what the user is pointing at.
     */
    private updateHoveredProfile (x: number, y: number): void {
        this.hoveredProfileId = null
        const rows = document.querySelectorAll<HTMLElement>('.sidebar-plus-tree a.tree-item[data-profile-id]')
        for (const row of Array.from(rows)) {
            const rect = row.getBoundingClientRect()
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                this.hoveredProfileId = row.dataset.profileId ?? null
                return
            }
        }
    }

    ////// DRAG & DROP //////
    get profileListIds (): string[] {
        return this.profileGroups.map(g => `profiles-${g.id}`)
    }

    async onProfileDrop (
        event: CdkDragDrop<PartialProfile<Profile>[]>,
        targetGroup: PartialProfileGroup<ProfileGroup>,
    ): Promise<void> {
        // Nothing happens on a drop that resolves to no usable target, and the
        // selection is deliberately left intact so the user can simply try
        // again. A drop released outside every drop list never reaches this
        // handler at all — CDK only emits `cdkDropListDropped` for a container
        // it recognises — and `cdkDragEnded` fires either way, which is what
        // brings the hidden rows back.
        const isRealTarget = targetGroup.editable || targetGroup.id === 'ungrouped'
        if (!isRealTarget) {
            return
        }

        // Dragging one row of a multi-selection moves the whole batch. The
        // roadmap had ruled multi-drag out as too fragile, which was true while
        // it would have meant teaching onProfileDrop() and the drag preview to
        // carry N items; now that moveSelectionToGroup() exists and is tested,
        // the drop just delegates to it. Only when the profile actually leaves
        // its container: a drop inside the same folder is a reorder, which the
        // selection has nothing to say about.
        //
        // Known cosmetic limit: CDK's drag preview still shows the single row
        // being dragged, not the stack.
        const draggedProfile = event.previousContainer.data[event.previousIndex]
        if (
            event.previousContainer !== event.container &&
            this.selectedProfileIds.size > 1 &&
            this.isProfileSelected(draggedProfile)
        ) {
            await this.moveSelectionToGroup(targetGroup, this.hoveredProfileId)
            return
        }

        const sourceGroupId = SidebarPlusTreeComponent.groupIdFromContainerId(event.previousContainer.id)

        if (event.previousContainer === event.container) {
            // Reordering inside one folder goes through the same placement
            // rule whether one row or a whole selection is moving: the batch
            // lands just below the row actually under the pointer. A single
            // row used to take CDK's own moveItemInArray() path instead, which
            // dropped it *above* the row aimed at — the same mismatch already
            // fixed for multi-selections.
            const movingIds = this.selectedProfileIds.size > 1 && this.isProfileSelected(draggedProfile)
                ? this.selectedProfileIds
                : new Set(draggedProfile.id ? [draggedProfile.id] : [])
            SidebarPlusTreeComponent.moveSelectionWithinArray(
                event.container.data,
                movingIds,
                event.currentIndex,
                this.hoveredProfileId,
            )
        } else {
            const profile = event.previousContainer.data[event.previousIndex]
            transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex)
            profile.group = targetGroup.id === 'ungrouped' ? undefined : targetGroup.id
            await this.profilesService.writeProfile(profile)
            // Only when the source is a real folder. CDK resolves a drop target
            // among the lists connected to the *source*, so a profile can be
            // dragged out of "Épinglés" even though nothing can be dropped into
            // it — and persisting that list's order on the "Tous" workspace
            // rewrote `weight` on every profile still pinned, ranking them by
            // their position among the favorites instead of within their own
            // folders.
            if (!SidebarPlusTreeComponent.isSyntheticGroupId(sourceGroupId)) {
                await this.persistProfileOrder(sourceGroupId, event.previousContainer.data)
            }
        }
        await this.persistProfileOrder(targetGroup.id, event.container.data)
        this.config.save()
    }

    /**
     * Reorders a whole multi-selection within one folder: every selected row
     * is pulled out and re-inserted as a single contiguous block at the drop
     * point.
     *
     * Placement is driven by `hoveredProfileId` — the row genuinely under the
     * pointer — and the block goes *below* it, which the user found the natural
     * reading of dropping onto a row.
     *
     * `targetIndex` (CDK's `currentIndex`) is only a fallback for when the
     * pointer is over no row at all, or over one of the dragged rows
     * themselves. Deriving the position from it was the first approach and it
     * was wrong in both directions: the block landed above the targeted row
     * whichever way the drag came from, because `currentIndex` is expressed
     * against the array minus the single row CDK tracked, not minus the whole
     * selection.
     */
    private static moveSelectionWithinArray (
        data: PartialProfile<Profile>[],
        selectedIds: Set<string>,
        targetIndex: number,
        hoveredProfileId: string|null,
    ): void {
        const isSelected = (p: PartialProfile<Profile>): boolean => !!p.id && selectedIds.has(p.id)
        const block = data.filter(isSelected)
        const rest = data.filter(p => !isSelected(p))

        let insertAt = -1
        if (hoveredProfileId) {
            const hoveredIndex = data.findIndex(p => p.id === hoveredProfileId)
            if (hoveredIndex !== -1) {
                // The hovered row may itself be part of the block — easy to hit
                // when dragging upwards, since the selected rows travel under
                // the cursor. Anchor on the nearest *unselected* row at or
                // above it instead of giving up: that row is what the block
                // should land beneath. None above at all means the block
                // belongs at the very top.
                let anchorIndex = -1
                for (let i = hoveredIndex; i >= 0; i--) {
                    if (!isSelected(data[i])) {
                        anchorIndex = i
                        break
                    }
                }
                if (anchorIndex === -1) {
                    insertAt = 0
                } else {
                    insertAt = rest.findIndex(p => p.id === data[anchorIndex].id) + 1
                }
            }
        }
        if (insertAt === -1) {
            insertAt = 0
            for (let i = 0; i < Math.min(targetIndex, data.length); i++) {
                if (!isSelected(data[i])) {
                    insertAt++
                }
            }
        }
        rest.splice(insertAt, 0, ...block)
        // Spliced in place rather than reassigned: `data` is the very array the
        // template renders and CDK holds a reference to.
        data.splice(0, data.length, ...rest)
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

        // config.store holds the *user's* entries only. The tree also shows
        // profiles contributed by providers (getProfileGroups() is called with
        // includeNonUserGroup, which passes includeBuiltin down to
        // getProfiles()) and the synthetic groups they are filed under —
        // 'built-in' plus one per provider-declared group name. None of those
        // exist in config.store, so judging liveness on it alone would call a
        // builtin profile's position dead and reset it without a word.
        // rawGroupsSnapshot is the same unfiltered snapshot deleteGroup() and
        // rescueTargetGroupId() already consult.
        for (const group of this.rawGroupsSnapshot) {
            liveGroupIds.add(group.id)
            for (const profile of group.profiles ?? []) {
                if (profile.id) {
                    liveProfileIds.add(profile.id)
                }
            }
        }

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

    /**
     * Drops every trace of an id that has just been deleted — the mirror image
     * of migrateWorkspaceGroupId(), which carries those same traces over when
     * an id *changes*. Same list, same consequence if one is forgotten, one
     * difference: a leftover here costs nothing visible, it just accumulates.
     *
     * Done at the point of deletion rather than by sweeping the config against
     * the live entries, which is what pruneDeadOrderIds() does for the order
     * maps and what this deliberately does not copy. A sweep has to answer
     * "does this id still exist?", and the honest answer needs the *unfiltered*
     * snapshot — builtin profiles and their synthetic groups included, see the
     * note in pruneDeadOrderIds(). Here the deleted id is known outright, so
     * nothing has to be inferred and a favourite can never be dropped by
     * mistake.
     *
     * Every workspace is visited, not only the active one: hiding and pinning
     * are per-workspace, and the entry the user is not looking at is precisely
     * the one nobody would clean up by hand.
     */
    private forgetDeletedId (kind: 'profile'|'group', id: string): void {
        this.config.store.sidebarPlus ??= {}
        const sidebarPlus = this.config.store.sidebarPlus
        const without = (list: string[]|undefined): string[] => (list ?? []).filter(x => x !== id)

        // Explicit reassignment on every write, here as everywhere else in this
        // file: a nested in-place mutation is never picked up as a change to
        // persist (piège #23).
        if (kind === 'profile') {
            sidebarPlus.favorites = without(sidebarPlus.favorites)
        } else {
            sidebarPlus.favoriteGroups = without(sidebarPlus.favoriteGroups)
        }

        const workspaces: SidebarWorkspace[] = sidebarPlus.workspaces ?? []
        for (const ws of workspaces) {
            if (kind === 'profile') {
                ws.favorites = without(ws.favorites)
                ws.hiddenProfileIds = without(ws.hiddenProfileIds)
            } else {
                ws.favoriteGroups = without(ws.favoriteGroups)
                ws.hiddenGroupIds = without(ws.hiddenGroupIds)
            }
        }
        sidebarPlus.workspaces = workspaces

        if (kind === 'group') {
            // Collapsed state lives in localStorage, not in config.yaml — same
            // reasoning as in migrateWorkspaceGroupId(), and unreadable storage
            // is not worth failing a deletion over.
            try {
                const collapsed = JSON.parse(window.localStorage.sidebarPlusGroupCollapsed ?? '{}')
                if (id in collapsed) {
                    delete collapsed[id]
                    window.localStorage.sidebarPlusGroupCollapsed = JSON.stringify(collapsed)
                }
            } catch {
                // Nothing to clean if it cannot be read.
            }
        }

        // Called *after* the entry is gone from config.store, so the id it has
        // to collect actually reads as dead.
        this.pruneDeadOrderIds()
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
        const fullGroup = allGroups.find(g => g.id === groupId)
        // Carried over wholesale rather than field by field. Listing the four
        // fields the sidebar knows about silently dropped `defaults` — the
        // per-provider group defaults Tabby merges into the ConfigProxy of
        // *every profile of the folder* — so re-parenting a folder stripped its
        // profiles of everything they inherited from it. Anything a future
        // tabby-core adds to ProfileGroup now follows on its own.
        //
        // Three fields are deliberately left out: `id`, which has to be empty
        // for `genId` to mint a new one; `profiles`, whose members are migrated
        // one at a time below; and `children`, which only exists on a tree node
        // and would be stale the moment the recursion rebuilds it.
        const { id: _id, profiles: _profiles, children: _children, ...carried } =
            (fullGroup ?? {}) as PartialProfileGroup<ProfileGroup> & { children?: unknown }
        const replacement = {
            ...carried,
            id: '',
            // From `meta` rather than from the snapshot: the caller hands over
            // the node as displayed, which is the one carrying a rename made
            // in this very gesture.
            name: meta.name,
            icon: meta.icon,
            color: meta.color,
            parentGroupId: newParentGroupId ?? undefined,
        } as PartialProfileGroup<ProfileGroup>
        await this.profilesService.newProfileGroup(replacement, { genId: true })

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

        // No forgetDeletedId() after this one, unlike deleteGroup(): the
        // migration just above renamed every trace of the old id, so there is
        // nothing left of it to collect. Order matters — migrate, then delete.
        await this.profilesService.deleteProfileGroup((fullGroup ?? { id: groupId }) as PartialProfileGroup<ProfileGroup>)
        // Returned so the caller can persist the sibling order under the NEW
        // id — see reparentDraggedGroup().
        return replacement.id
    }

    /**
     * Carries every trace of a group's id over to the one it was just given.
     *
     * Everything keyed by group id has to be listed here — a state left behind
     * does not fail, it silently reverts to its default the next time the tree
     * loads. `favoriteGroups` was the one missing: re-parenting a pinned folder
     * dropped its star and left a dead id nobody ever collects, since
     * `pruneDeadOrderIds()` only walks the order maps.
     */
    private migrateWorkspaceGroupId (oldId: string, newId: string): void {
        this.config.store.sidebarPlus ??= {}
        const workspaces: SidebarWorkspace[] = this.config.store.sidebarPlus.workspaces ?? []
        for (const ws of workspaces) {
            const hiddenIndex = ws.hiddenGroupIds.indexOf(oldId)
            if (hiddenIndex !== -1) {
                ws.hiddenGroupIds[hiddenIndex] = newId
            }
            const favoriteIndex = ws.favoriteGroups?.indexOf(oldId) ?? -1
            if (favoriteIndex !== -1) {
                ws.favoriteGroups[favoriteIndex] = newId
            }
            SidebarPlusTreeComponent.renameOrderKey(ws.groupOrder, oldId, newId)
        }
        this.config.store.sidebarPlus.workspaces = workspaces

        // The "Tous" workspace's own favorites, which live at the top level
        // rather than in an entry of `workspaces`.
        const favorites: string[] = this.config.store.sidebarPlus.favoriteGroups ?? []
        const topLevelIndex = favorites.indexOf(oldId)
        if (topLevelIndex !== -1) {
            favorites[topLevelIndex] = newId
            this.config.store.sidebarPlus.favoriteGroups = favorites
        }

        this.config.store.sidebarPlus.groupOrder ??= {}
        SidebarPlusTreeComponent.renameOrderKey(this.config.store.sidebarPlus.groupOrder, oldId, newId)

        // Collapsed state lives in localStorage, not in config.yaml — same
        // reasoning, same consequence if forgotten: the folder came back
        // expanded after every re-parenting.
        try {
            const collapsed = JSON.parse(window.localStorage.sidebarPlusGroupCollapsed ?? '{}')
            if (oldId in collapsed) {
                collapsed[newId] = collapsed[oldId]
                delete collapsed[oldId]
                window.localStorage.sidebarPlusGroupCollapsed = JSON.stringify(collapsed)
            }
        } catch {
            // Unreadable storage is not worth failing a move over.
        }
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
        // 'ungrouped' is not editable (it is Tabby's synthetic bucket, it has
        // no name/icon/children to act on) but it *is* a legal move target —
        // onProfileDrop() accepts it, so a drag can put profiles there while
        // the menu could not. Opened for that one purpose when a selection is
        // waiting, with a reduced menu offering only the move.
        if (!group.editable && !this.canMoveSelectionTo(group)) {
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
        // The tunnels popup is the only one holding a form the user may have
        // half filled in, and losing it to a stray click is destructive in a
        // way none of the other popups are (they either hold nothing or a
        // single field). It closes on its ✕ or on Escape, never on an outside
        // click.
        if (!this.isTunnelsMode) {
            this.closeContextMenu()
        }
        // Clicking anywhere that is not a profile row drops the selection
        // (empty space, a folder row, the workspace bar) — the OS-standard
        // "click away to deselect". Profile rows are excluded because
        // onProfileClick() owns that case and needs to read the modifier keys;
        // letting this run there would clear the selection on the very click
        // meant to extend it. Tested by attribute rather than by trusting a
        // descendant's stopPropagation(), which does not suppress this
        // HostListener at all (piège #15).
        // .selection-bar is excluded too: it is the readout of the selection,
        // so clicking it must not be what destroys it. Its own ✕ clears
        // explicitly.
        if (!target.closest('[data-profile-row], .selection-bar')) {
            this.clearSelection()
        }
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
        // OS-standard, and spelled out in the roadmap: right-clicking *outside*
        // the current selection drops it and opens the plain single-profile
        // menu. Right-clicking inside it leaves the selection alone.
        if (!this.isProfileSelected(profile)) {
            this.clearSelection()
        }
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

    async onIconQueryChange (): Promise<void> {
        const q = this.iconQuery.trim().toLowerCase()
        if (!q) {
            this.iconMatches = []
            return
        }
        const entries = await loadIconEntries()
        // The icon sets load once, so only the very first search can await
        // anything — but that one await is long enough (5 MB of JSON to decode
        // and sort) for the user to keep typing, or to close the picker. Drop
        // the result if the query has moved on, otherwise a stale list would
        // overwrite the current one.
        if (this.iconQuery.trim().toLowerCase() !== q) {
            return
        }
        this.iconMatches = entries.filter(e => e.name.includes(q)).slice(0, 40)
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
     * Opens Tabby's own profile edit modal directly, exactly the way
     * `tabby-settings` opens it for its own list: `ngbModal.open()`, hand it a
     * clone and the profile's provider, then `writeProfile()` the result.
     *
     * This used to drive tabby-settings' DOM instead — open Settings >
     * Profiles, click every collapsed group open, find the row whose `span`
     * carries the profile name, click it, then poll for `.modal-content` to
     * learn when to close the tab again. That was the single most fragile
     * point of the plugin, and it was never necessary: the comment justifying
     * it claimed no public API existed, while `pickProfileTemplate()` opened
     * the very same modal a few hundred lines above. `EditProfileModalComponent`
     * is `@hidden`, which proves nothing about what is exported at runtime
     * (piège #13), and `src/tabby-settings-augment.d.ts` already declared it.
     *
     * Opening a Settings tab was the *vehicle*, never the intent. It survives
     * only as the fallback below, for a profile whose provider cannot be
     * resolved — where Tabby itself throws.
     */
    async editProfile (profile?: PartialProfile<Profile>): Promise<void> {
        this.closeContextMenu()
        if (!profile) {
            return
        }

        const provider = this.profilesService.providerForProfile(profile)
        if (!provider) {
            // tabby-settings throws here. Sending the user somewhere they can
            // finish the job by hand beats a stack trace they never see.
            this.notifications.error(`Aucun fournisseur ne gère « ${profile.name} » — ouverture des paramètres`)
            this.openProfilesSettingsTab()
            return
        }

        const modal = this.ngbModal.open(EditProfileModalComponent, { size: 'lg' })
        // Never the live object: the modal mutates what it is handed, so a
        // cancelled edit would otherwise keep its changes — in the displayed
        // tree, and in `config.store` for anything reachable from it (piège
        // #12). tabby-settings clones here too, for the same reason.
        modal.componentInstance.partialProfile = structuredClone(profile)
        modal.componentInstance.profileProvider = provider

        const result = await modal.result.catch(() => null) as PartialProfile<Profile>|null
        if (!result) {
            return
        }
        result.type = provider.id
        await this.profilesService.writeProfile(result)
        await this.config.save()
    }

    /** Settings > Profiles, reusing a Settings tab the user already had open. Only reached when a profile has no resolvable provider. */
    private openProfilesSettingsTab (): void {
        const existing = this.app.tabs.find(t => t instanceof SettingsTabComponent) as SettingsTabComponent|undefined
        if (existing) {
            existing.activeTab = 'profiles'
            this.app.selectTab(existing)
            return
        }
        this.app.openNewTabRaw({ type: SettingsTabComponent, inputs: { activeTab: 'profiles' } })
    }

    /**
     * Refuses to delete a folder that still holds anything — counted on the
     * *unfiltered* snapshot, not on the node as displayed.
     *
     * The displayed node has already been through the active workspace's
     * hide lists, so a folder whose whole content is hidden there looked empty
     * and sailed past this guard. `deleteProfileGroup()` then removed the group
     * and cleared `group` on every profile that lived in it: the hidden
     * profiles resurfaced in "Ungrouped", visible everywhere, and hidden
     * subfolders were orphaned up to the root. `rawGroupsSnapshot` is the same
     * source `isSelfOrDescendant()` and `rescueTargetGroupId()` already consult
     * for exactly this kind of check.
     */
    async deleteGroup (group: PartialProfileGroup<CollapsableProfileGroup>): Promise<void> {
        const childCount = this.rawGroupsSnapshot.filter(g => g.parentGroupId === group.id).length
        const profileCount = this.rawGroupsSnapshot.find(g => g.id === group.id)?.profiles?.length ?? 0
        if (childCount || profileCount) {
            const reasons: string[] = []
            if (childCount) {
                reasons.push(`${childCount} sous-dossier${childCount > 1 ? 's' : ''}`)
            }
            if (profileCount) {
                reasons.push(`${profileCount} profil${profileCount > 1 ? 's' : ''}`)
            }
            // Said explicitly when the folder looks empty on screen: otherwise
            // the refusal reads as a bug rather than as a warning.
            const visible = (group.children?.length ?? 0) + (group.profiles?.length ?? 0)
            const hint = visible === 0
                ? ` Ce contenu est masqué dans le workspace « ${this.activeWorkspace?.name ?? 'courant'} ».`
                : ''
            this.notifications.error(
                `Impossible de supprimer "${group.name}"`,
                `Ce dossier contient encore ${reasons.join(' et ')}.${hint} Videz-le d'abord.`,
            )
            this.closeContextMenu()
            return
        }
        await this.profilesService.deleteProfileGroup(group)
        this.forgetDeletedId('group', group.id)
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
        if (profile.id) {
            this.forgetDeletedId('profile', profile.id)
        }
        await this.config.save()
        this.closeContextMenu()
    }
}
