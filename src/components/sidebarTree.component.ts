import './sidebarTree.component.scss'
// Shown in the footer bar. Imported from package.json (resolveJsonModule) so it
// tracks the real version at every bump rather than a hand-kept copy.
import { version as PLUGIN_VERSION } from '../../package.json'
import FuzzySearch from 'fuzzy-search'
import { merge, Subscription, timer } from 'rxjs'
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop'
import { AfterViewChecked, Component, ElementRef, HostBinding, HostListener, Inject, Injector, Input, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core'
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
    TAB_COLORS,
} from 'tabby-core'
import { SettingsTabComponent } from 'tabby-settings'
import { BaseTerminalTabComponent } from 'tabby-terminal'
import { SidebarPlusSettingsTabComponent } from './settingsTab.component'
import { SidebarPlusSftpComponent } from './sftpPanel.component'
import { SnippetsModalComponent, SnippetsModalResult } from './snippetsModal.component'
import { NoteModalComponent } from './noteModal.component'
import { PasteGroupModalComponent, PasteResolution } from './pasteGroupModal.component'
import { TunnelsModalComponent } from './tunnelsModal.component'
import { IconPickerModalComponent } from './iconPickerModal.component'
import { ForwardedPortConfig, PortForwardType, SSHTabComponent } from 'tabby-ssh'

/**
 * A live forward as the session holds it. The `ForwardedPort` class is not
 * exported by the vendored typings' index — borrowed through the one member
 * that publicly exposes it, same pattern as `SftpSession` in transfers.ts.
 */
type LiveForward = NonNullable<SSHTabComponent['sshSession']>['forwardedPorts'][number]
import { SidebarSnippet, SidebarWorkspace } from '../configProvider'
import { SidebarPlusI18nService } from '../i18n'
import { SidebarPlusSnippetsService } from '../snippets.service'
import { SidebarPlusNoticesService } from '../notices.service'
import { FOCUS_FILTER_HOTKEY } from '../hotkeys'
import { PingState, SidebarPlusPingService } from '../ping.service'
import { focusTab, getAllOpenTabs, isLiveSSHTab, isSSHTab } from '../tabs'
import { hostSupports } from '../hostCompat'
import { readProfileGroups } from '../profileGroups'
import { buildPayload, countPayload, describePurge, isEmptyReport, parsePayload, PurgeLevel, PurgeReport, SharedGroup } from '../groupShare'
import { buildWorkspacePayload, generateWorkspaceId, parseWorkspacePayload, uniqueWorkspaceName } from '../workspaceShare'
import { formatTunnel, tunnelKey } from '../tunnels'
import { BetterPanelContribution, electBetterPanelHost, SIDEBAR_PANEL_TOKEN } from '../betterPanel'
import { openProfileModal, PROFILE_MODAL_UNAVAILABLE } from '../profileModal'
import { TranslatableMessage } from '../i18nMessage'
import { clampInViewport } from '../viewport'
import { formatSpeed, SidebarPlusTransfersService } from '../transfersRegistry.service'

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
    /**
     * `live` is a mounted forward. `waiting` is remembered from a session that
     * just died — the row stays, dimmed, while the session gets a chance to
     * come back (see TUNNEL_LOSS_GRACE_MS). `lost` is the aftermath of a
     * reconnection: a forward the revived session did *not* remount, which is
     * exactly what happens to a tunnel added on the fly — Tabby only remounts
     * what the profile carries (verified in `ssh.ts:493`, nothing else is
     * replayed). Shown for a while so the loss is seen instead of silent.
     */
    state: 'live'|'waiting'|'lost'
    /** The row's whole hover text, composed once — the detail, plus what the state means when it is not `live`. */
    tooltip: string
    /** `tunnelKey()` of the forward — never displayed, carried so memory can match rows across a reconnection. */
    key: string
}

/** What `tunnelMemory` keeps per forward — enough to rebuild a row without the (dead) session. */
interface RememberedTunnel {
    key: string
    sessionName: string
    label: string
    detail: string
}

/** What `tunnelMemory` keeps per SSH tab, across the death and revival of its session. */
interface TunnelMemoryEntry {
    rows: RememberedTunnel[]
    /** When the session was first seen dead, null while it lives. */
    lostAt: number|null
    /** Rows for forwards a revived session did not bring back, each with its display deadline. */
    ghosts: { row: ActiveTunnel, until: number }[]
}

/**
 * How long a dead session's tunnels stay visible as « en attente de reprise ».
 *
 * Long enough to cover an automatic reconnection and a human clicking
 * "Reconnect" without hurrying; bounded because a session nobody revives is a
 * session that was closed, and its tunnels with it. The SFTP panel's 3 s grace
 * answers a different question (when to *leave* the view) — this one is about
 * how long a line may honestly claim it might come back.
 */
const TUNNEL_LOSS_GRACE_MS = 60_000

/** How long a « non remonté » row lingers after a reconnection before the loss is considered acknowledged. */
const TUNNEL_NOT_RESTORED_MS = 30_000

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
    /**
     * Number of the registry's `active` entries whose `sessionLabel` matches
     * this session's own `name` — see refreshSessionTransfers(). Zero means
     * nothing is moving on this session right now.
     */
    transferCount: number
    /** Combined speed of those entries, already formatted (shared formatSpeed()) — blank while count is 0 or no tick has produced a figure yet. */
    transferSpeedLabel: string
    /**
     * The row's whole compact segment ("3 ⇅ 2,4 Mo/s"), precomposed here
     * rather than concatenated in the template (piège #54) — blank when
     * transferCount is 0, in which case the row falls back to the uptime.
     */
    transferLabel: string
}

@Component({
    selector: 'sidebar-plus-tree',
    template: require('./sidebarTree.component.pug'),
})
export class SidebarPlusTreeComponent implements OnInit, OnDestroy, AfterViewChecked {
    /** Shown in the footer bar next to the plugin name. */
    readonly pluginVersion = PLUGIN_VERSION
    /** Footer links. Constants rather than template literals: the template must not compute (piège #54). */
    readonly repositoryUrl = 'https://github.com/TooMuhtsh/tabby-better-sidebar'
    readonly authorUrl = 'https://github.com/TooMuhtsh?tab=repositories'
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
    /**
     * Reference to the mounted SFTP panel, so openSessionSftp() can reach
     * past its own focus-follows-tab handshake and unfreeze a pin left
     * standing from an earlier navigation. Optional: absent whenever
     * `showSftp` is off, since the tag itself is `*ngIf`'d out then.
     */
    @ViewChild(SidebarPlusSftpComponent) private sftpPanel?: SidebarPlusSftpComponent
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

    /**
     * 'tabs' (the original `.workspace-bar` strip, wraps onto more rows as
     * workspaces pile up) or 'dropdown' (a single-line "active workspace +
     * chevron" trigger opening the full list as a popup) — an explicit
     * per-user setting (workspaceSelectorMode in configProvider.ts's
     * defaults, exposed in the settings tab next to showWorkspaces), not an
     * auto-detected one. An earlier pass here drove this off a
     * ResizeObserver instead and was rejected in testing (2026-08-07): it
     * picked the layout out from under the user mid-session, and its
     * right-click handling inside the dropdown popup — opening a *second*
     * `.group-context-menu`-classed popup as a side effect of the very click
     * that removed the first one, both matched by the same
     * `document.querySelector()` in clampContextMenuPosition() — turned out
     * unreliable (the same class of ambiguity as piège #30, just never
     * exercised by any earlier feature the way this one does). See
     * openWorkspaceMenuFromSwitcher() below for how list mode manages a
     * workspace instead (each row's "⋯" button, fixed anchor, list kept
     * open underneath — not a right-click).
     */
    get workspaceSelectorMode (): 'tabs'|'dropdown' {
        return this.config.store.sidebarPlus?.workspaceSelectorMode ?? 'tabs'
    }

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

    ////// TRANSFER ACTIVITY ARROWS //////
    /**
     * profileId → whether it currently carries an `active` upload/download,
     * precomputed rather than read from a template getter (piège #54): the
     * `.transfer-activity` badge is on every profile row, and a getter there
     * would rescan the whole registry on every change detection pass.
     *
     * Rebuilt by refreshTransferActivity(), never mutated in place.
     */
    profileActivity = new Map<string, { up: boolean, down: boolean }>()
    /**
     * Session display name → the profile that launched it, built by
     * refreshActiveSessions() from the same live SSH tabs it already walks.
     *
     * The registry's entries carry a `sessionLabel` (G5's plain-field
     * principle: composed by whoever starts the transfer, the only party that
     * knows) but no profile id — nothing upstream of it needs one. This is the
     * join back to a profile row, by the one string both sides compute the
     * same way: `tab.customTitle || tab.topmostParent?.customTitle ||
     * profile.name || tab.title`, mirrored in sftpPanel.component.ts's own
     * `sessionLabel` assignment. A tab renamed *after* a transfer started, or
     * one that closed before this map's next refresh, is the accepted gap —
     * the alternative was stamping a profile id at every registration site,
     * several of which live in sftpBrowser.component.ts (off limits here).
     */
    private sessionLabelToProfileId = new Map<string, string>()
    private transfersActivitySubscription: Subscription|null = null

    ////// RECENT PROFILES //////
    /**
     * Ids of the last profiles launched through launchProfile() — the single
     * point every launch path in this component funnels through — most
     * recent first, deduplicated, capped at MAX_RECENT_PROFILES.
     *
     * Persisted to `localStorage.sidebarPlusRecentProfiles`, deliberately
     * *not* `config.store.sidebarPlus`: this is per-machine usage, not
     * something a synced config.yaml should carry between machines — the
     * exact reasoning documented for `sidebarPlusActiveWorkspace` (switching
     * what you're looking at, here what you last launched, must not follow
     * you to another machine). See ROADMAP #historique-profils.
     *
     * Also deliberately not filtered by workspace, neither on write nor on
     * read: a launch is a fact of the app, the same reasoning already applied
     * to `activeSessions` above.
     */
    private recentProfileIds: string[] = SidebarPlusTreeComponent.loadRecentProfileIds()
    /** Per-machine UI state, same pattern as activeSessionsCollapsed. */
    recentProfilesCollapsed = window.localStorage.sidebarPlusRecentProfilesCollapsed === 'true'
    private static readonly MAX_RECENT_PROFILES = 5

    private static loadRecentProfileIds (): string[] {
        try {
            const raw = window.localStorage.sidebarPlusRecentProfiles
            if (!raw) {
                return []
            }
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
        } catch {
            // Malformed localStorage (hand-edited, older format…) — worth
            // starting empty rather than throwing the sidebar's constructor.
            return []
        }
    }

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
        'menu'|'createGroup'|'createProfile'|'confirmDeleteProfile'|'rename'|
        'workspaceMenu'|'createWorkspace'|'renameWorkspace'|'confirmDeleteWorkspace'|'workspaceColor'
        = 'menu'
    /** Set whenever a context menu/popup opens or switches mode — checked once in ngAfterViewChecked() to clamp it back on-screen after Angular renders it at its real size. */
    private menuPositionDirty = false

    ////// LATERAL SUBMENUS (Manage / More, folder + profile menus) //////
    // Windows-style side panels for the folder and profile context menus,
    // which had grown to 13 top-level entries each and kept "extending
    // towards infinity" (user report). Only one plugin-wide field: the two
    // menus are mutually exclusive (contextMenuGroup xor contextMenuProfile),
    // so nothing needs to know which parent it belongs to.
    /** Which submenu is open, or none — opening either replaces the other, so a single field is enough. */
    activeSubmenu: 'manage'|'more'|null = null
    submenuX = 0
    submenuY = 0
    // The carrying entry's own rect at the moment it opened the submenu —
    // not just the x/y the submenu renders at, which clampSubmenuPosition()
    // is free to move. Needed to decide whether to flip the panel to the
    // entry's LEFT once its real width is known (piège #30's clamp only
    // pulls a box back inside the viewport, it never flips a side panel to
    // the other side of its anchor).
    private submenuAnchorLeft = 0
    private submenuAnchorRight = 0
    private submenuAnchorTop = 0
    /** Set whenever the submenu opens or moves — checked once in ngAfterViewChecked(), same pattern as menuPositionDirty above and for the same reason (the DOM must have rendered the panel at its real size first). */
    private submenuPositionDirty = false
    /**
     * Debounces the submenu's close-on-mouseleave so the diagonal path from
     * the carrying entry to the panel beside it doesn't trip it — the pointer
     * briefly leaves the entry before it reaches the panel. Cancelled by
     * cancelSubmenuClose() if the pointer lands back on the entry or on the
     * panel itself before it fires. Deliberately simple (a flat delay, no
     * triangle-of-tolerance geometry): the user asked to keep this part
     * simple, and ~150-200ms already covers the normal case.
     */
    private submenuCloseTimer: ReturnType<typeof setTimeout>|null = null

    ////// WORKSPACE SWITCHER (list mode) //////
    // Deliberately NOT a contextMenuMode value: the modes are mutually
    // exclusive, so as one the switcher died the moment any popup it spawned
    // opened (the "⋯" menu, rename, colour…) — every step of a manage flow
    // dismissed the panel underneath it, which is exactly what the user
    // rejected in testing (2026-08-07, "au moindre clic le panneau précédent
    // disparaît"). As its own flag it stays put while the ordinary
    // contextMenuMode machinery opens and closes popups NEXT to it, and
    // closeContextMenu() landing back on 'menu' leaves the list on screen.
    workspaceSwitcherOpen = false
    workspaceSwitcherX = 0
    workspaceSwitcherY = 0

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

    get isWorkspaceColorMode (): boolean {
        return this.contextMenuMode === 'workspaceColor'
    }

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
        private snippets: SidebarPlusSnippetsService,
        // Not `notifications` for anything the user has to read: Tabby's
        // `notice()` hard-codes a one-second timeout, which is gone before it
        // is seen. See notices.service.ts.
        private notices: SidebarPlusNoticesService,
        @Inject(ProfileProvider) private profileProviders: ProfileProvider<Profile>[],
        private injector: Injector,
        private transfers: SidebarPlusTransfersService,
        private i18n: SidebarPlusI18nService,
    ) { }

    /**
     * Translates a `{ message, params }` handed back by a module with no
     * injector access of its own — `profileModal.ts`, `groupShare.ts`,
     * `workspaceShare.ts`, `svgSanitizer.ts` — at the one place that holds
     * `this.i18n`.
     */
    private tMsg (msg: TranslatableMessage): string {
        return this.i18n.t(msg.message, msg.params)
    }

    /**
     * `describePurge()`'s clauses, translated and joined — the sentence that
     * function used to build itself before it lost injector access. Empty
     * string when nothing was taken out, same as before.
     */
    private describePurgeText (report: PurgeReport): string {
        return describePurge(report).map(part => this.tMsg(part)).join(', ')
    }

    async ngOnInit (): Promise<void> {
        await this.loadTreeItems()
        // Kept so ngOnDestroy can drop it. The component *is* destroyed —
        // SidebarPlusMountService unmounts it when `sidebarPlus.enabled` goes
        // false — and an orphaned subscription here means a dead component
        // still rebuilding the whole tree on every config.save() of the
        // application, twice cloned, for as long as the window lives.
        this.configSubscription = this.config.changed$.subscribe(() => {
            // Before the reload, not after: switching a block off can change
            // the active workspace or drop the filter, both of which decide
            // what loadTreeItems() is supposed to build.
            this.reconcileHiddenBlocks()
            void this.loadTreeItems()
            // showTransfers can have just flipped — refreshTransferActivity()
            // reads it directly and clears the map rather than waiting for the
            // next registry event, which may never come if nothing is running.
            this.refreshTransferActivity()
            // Same reasoning for the sessions list's own compact segment: the
            // switch has to fall back to the uptime immediately, not on the
            // next 2s poll or registry event.
            this.refreshSessionTransfers()
        })

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
        // Recomputes on every meaningful registry change (an entry starting or
        // leaving `active`) rather than polling it — see `changed` on the
        // registry. `enabled`/`showTransfers` gates both this subscription's
        // effect and the source itself (piège: "un interrupteur de bloc coupe
        // la source, pas seulement la vue") — refreshTransferActivity() below
        // clears the map instead of computing anything while the block is off.
        this.transfersActivitySubscription = this.transfers.changed.subscribe(() => {
            this.zone.run(() => {
                this.refreshTransferActivity()
                // Same event, same reasoning as the arrows above: a transfer
                // starting or leaving `active` should show up on the session
                // row right away rather than waiting for the next 2s poll.
                this.refreshSessionTransfers()
            })
        })
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
        this.transfersActivitySubscription?.unsubscribe()
        if (this.selectionNoticeTimer) {
            clearTimeout(this.selectionNoticeTimer)
        }
    }

    ngAfterViewChecked (): void {
        if (this.submenuPositionDirty) {
            this.submenuPositionDirty = false
            setTimeout(() => this.clampSubmenuPosition())
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
        // :not(.workspace-switcher-menu): the switcher has its own fixed
        // anchor and its own coordinates, and can be on screen at the same
        // time as the contextMenuMode popup this clamp is aimed at — without
        // the exclusion, whichever comes first in DOM order would be measured
        // and the other one nudged to its position (piège #30's ambiguity,
        // made permanent now that the two coexist by design).
        const menu = document.querySelector<HTMLElement>('.group-context-menu:not(.workspace-switcher-menu), .create-popup')
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
            // rename, delete confirmation) is opened on `click`,
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
     * Positions the open lateral submenu beside the entry that carries it —
     * flipped to the entry's LEFT when there is no room to its right — then
     * runs the result through clampInViewport(), the plugin's one point for
     * pulling a floating element back on screen (piège #30). Same deferred
     * pattern as clampContextMenuPosition() and for the same reason: the
     * panel's real width is only known once Angular has actually rendered it.
     */
    private clampSubmenuPosition (): void {
        const panel = document.querySelector<HTMLElement>('.group-context-submenu')
        if (!panel) {
            return
        }
        const width = panel.getBoundingClientRect().width
        const fitsRight = this.submenuAnchorRight + width <= window.innerWidth
        const x = fitsRight ? this.submenuAnchorRight : this.submenuAnchorLeft - width
        const { x: clampedX, y: clampedY } = clampInViewport(panel, x, this.submenuAnchorTop)
        this.submenuX = clampedX
        this.submenuY = clampedY
        panel.style.left = `${clampedX}px`
        panel.style.top = `${clampedY}px`
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

        // Cloned by readProfileGroups(), which is the only place this plugin
        // calls getProfileGroups() — buildGroupTree() below writes a computed
        // `.children` onto whatever it is handed, and that must never be a live
        // config.store object (piège #12).
        let groups = await readProfileGroups(this.profilesService, this.config)

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
        // Persisted only while the workspaces block is on. With it off, the
        // active workspace is forced to "Tous" for display, and writing that
        // here would erase the user's real selection — a switch must never
        // overwrite a choice it merely stops showing. The one case that still
        // has to be written is a workspace that no longer exists, handled above
        // by the same fallback and legitimately persistent.
        if (this.showWorkspaces) {
            window.localStorage.sidebarPlusActiveWorkspace = activeWorkspaceId
        }
        this.rawGroupsSnapshot = rawGroupsSnapshot
        // The snippet service walks a profile up to the root and has no
        // snapshot of its own — see `useGroups()` for why it is handed one
        // rather than fetching it.
        this.snippets.useGroups(rawGroupsSnapshot)
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
        this.noticeUnansweredVariables(profile)
        this.recordRecentProfile(profile)
        return this.profilesService.launchProfile(this.withWorkspaceColor(profile))
    }

    /**
     * Pushes a launch onto the MRU trail — gated on showRecentProfiles so
     * that switching the block off stops the recording, not just the
     * display (the project's "un interrupteur de bloc coupe la source" rule).
     * Silently does nothing for a profile with no id (a template preview,
     * never actually reachable through launchProfile(), but nothing here
     * should assume it).
     */
    private recordRecentProfile (profile: PartialProfile<Profile>): void {
        if (!this.showRecentProfiles || !profile.id) {
            return
        }
        const id = profile.id
        this.recentProfileIds = [id, ...this.recentProfileIds.filter(existing => existing !== id)]
            .slice(0, SidebarPlusTreeComponent.MAX_RECENT_PROFILES)
        window.localStorage.sidebarPlusRecentProfiles = JSON.stringify(this.recentProfileIds)
    }

    /**
     * Resolves the MRU ids against the same in-memory profile list the tree
     * itself is built from — `rawGroupsSnapshot`, the workspace-*unfiltered*
     * snapshot `loadTreeItems()` refreshes on every reload — rather than
     * `config.store.profiles`, which omits provider-supplied profiles
     * entirely (piège #74: testing existence there would silently drop a
     * still-live entry, not just fail to show a dead one).
     *
     * An id that fails to resolve is skipped here, never removed from
     * `recentProfileIds`: unlike a deleted profile (which forgetDeletedId()
     * actively forgets from every workspace's state), a provider-supplied
     * profile can be resolvable again the next time its provider lists it,
     * so dropping it from the trail on one miss would be premature.
     *
     * Not filtered by the active workspace, on purpose — same "fact of the
     * app" reasoning as `activeSessions`, see ROADMAP #historique-profils.
     */
    get recentProfiles (): PartialProfile<Profile>[] {
        if (!this.showRecentProfiles || !this.recentProfileIds.length) {
            return []
        }
        const byId = new Map<string, PartialProfile<Profile>>()
        for (const group of this.rawGroupsSnapshot) {
            for (const profile of group.profiles ?? []) {
                if (profile.id) {
                    byId.set(profile.id, profile)
                }
            }
        }
        const resolved: PartialProfile<Profile>[] = []
        for (const id of this.recentProfileIds) {
            const profile = byId.get(id)
            if (profile) {
                resolved.push(profile)
            }
        }
        return resolved
    }

    toggleRecentProfiles (): void {
        this.recentProfilesCollapsed = !this.recentProfilesCollapsed
        window.localStorage.sidebarPlusRecentProfilesCollapsed = this.recentProfilesCollapsed
    }

    /** The row's whole click target — a relaunch, nothing else (no context menu, no favorite, no status: a pure re-engagement shortcut, per ROADMAP #historique-profils). */
    launchRecentProfile (profile: PartialProfile<Profile>, event: MouseEvent): void {
        event.preventDefault()
        void this.launchProfile(profile)
    }

    /**
     * Tints a launch with the active workspace's color — on a *clone*, never
     * the live profile (piège #12: a mutation of the profile the tree still
     * renders is exactly what corrupted the user's config.yaml once).
     *
     * No new coloring mechanism: `ProfilesService.newTabParametersForProfile()`
     * (tabby-core, services/profiles.service.ts) already reads
     * `fullProfile.color` and forwards it as the new tab's `color` input —
     * the same field `profile-icon` colors its glyph with and
     * `TabHeaderComponent` draws a `.colorbar` from. `TAB_COLORS`
     * (tabby-core/utils.ts) is the very palette this plugin's workspace color
     * picker offers, so a workspace-tinted session looks identical to one
     * colored by hand from a tab's own native menu. This only decides which
     * value reaches that existing field.
     *
     * "Tous" never colors anything — `activeWorkspace` is already null there
     * — and a profile's own explicit color always wins: the workspace only
     * fills in what the profile left blank, it never overrides a choice
     * already made on the profile itself.
     */
    private withWorkspaceColor<P extends Profile> (profile: PartialProfile<P>): PartialProfile<P> {
        const workspace = this.activeWorkspace
        if (!workspace?.color || profile.color) {
            return profile
        }
        const tinted = structuredClone(profile)
        tinted.color = workspace.color
        return tinted
    }

    /**
     * Says, when a session opens, that snippets of this profile are waiting on
     * a value.
     *
     * The one moment worth saying it: a snippet edited in the settings tab can
     * introduce a placeholder that every profile already attached to it now
     * needs, and nothing else would surface that until someone clicked the
     * snippet and got a refusal. Here it arrives while the user is looking at
     * the profile.
     *
     * Keyed on the *set of missing names*, not on the profile: the same profile
     * has to speak up again when a snippet changes what it asks for, and stay
     * quiet when nothing has changed. That is also what keeps a folder-wide
     * launch from stacking one toast per session.
     */
    private noticeUnansweredVariables (profile: PartialProfile<Profile>): void {
        // Switched off means gone, not merely hidden: no menu entry, and no
        // work done on every launch for a feature nobody is using.
        if (!this.showSnippets) {
            return
        }
        const missing = this.snippets.unansweredFor(profile)
        if (!missing.length) {
            return
        }
        // Named per snippet, never merged into one list: the same placeholder
        // can be asked by two commands and mean two different things, so a bare
        // "{{path}} manque" would point at the wrong field.
        const detail = missing
            .map(entry => `${entry.snippet} : ${entry.names.map(name => `{{${name}}}`).join(', ')}`)
            .join(' · ')
        const key = `${profile.id ?? ''}|${detail}`
        if (this.variableNoticesShown.has(key)) {
            return
        }
        this.variableNoticesShown.add(key)
        this.notices.notice(
            this.i18n.t('Variables to fill in on "{name}"', { name: profile.name }),
            this.i18n.t('{detail}: right-click the profile, "Snippets", then the snippet settings button.', { detail }),
        )
    }

    /** What noticeUnansweredVariables() has already said this session — see there for why the key is the missing set and not the profile. */
    private readonly variableNoticesShown = new Set<string>()

    async launchProfileFromMenu (profile: PartialProfile<Profile>): Promise<void> {
        this.closeContextMenu()
        await this.launchProfile(profile)
    }

    /**
     * Launches the group's direct profiles, each in its own tab.
     *
     * No recursion into sub-groups, no split panes, no synced multi-input —
     * and none of the three is a gap left for later. They were the whole of
     * the "Group Exec" roadmap item, and all three were declined on 2026-08-03
     * once put as a question: recursion because forty sessions leave as easily
     * as four, splits because they only read well on the few servers one would
     * not have targeted a whole folder for, and broadcast because typing into
     * twelve production machines must not be a side effect of "open
     * everything". Tabby's own multi-input remains reachable by its hotkeys,
     * which is where it belongs.
     */
    async launchGroupSessions (group: PartialProfileGroup<CollapsableProfileGroup>): Promise<void> {
        this.closeContextMenu()
        const profiles = group.profiles ?? []
        if (!profiles.length) {
            this.notifications.notice(this.i18n.t('This folder contains no profile to launch'))
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
        if (!this.showFilter) {
            // Switching the view to the profiles for a field that is not there
            // would be worse than doing nothing: the hotkey would appear to
            // work, and take the user out of SFTP for nothing.
            return
        }
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
        const searchable = profiles.filter(p => !p.isTemplate)
        const matches: PartialProfile<Profile>[] = new FuzzySearch(
            searchable,
            ['name', 'description', 'options.host', 'options.user'],
            { sort: false },
        ).search(q)

        // Notes are searched in a second pass rather than as one more key of
        // the fuzzy search, which would have meant grafting the text onto each
        // profile: those very objects are what the tree renders and what
        // launch/duplicate are handed, so a computed field riding along into
        // `config.store` is piège #12's exact shape.
        //
        // A plain substring match, not fuzzy: what one looks for in a memo is a
        // ticket number or a hostname, where an approximate hit is noise.
        if (this.showNotes) {
            const needle = q.toLowerCase()
            const alreadyFound = new Set(matches.map(p => p.id))
            matches.push(...searchable.filter(p =>
                !alreadyFound.has(p.id) && this.noteFor(p.id).toLowerCase().includes(needle)))
        }

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
        // Picking a workspace is the switcher's terminal action — unlike the
        // manage flows, which keep the list open underneath (see the field's
        // own comment). No-op when the pick came from a tab.
        this.workspaceSwitcherOpen = false
        this.refreshTree()
    }

    /** Single re-entry point after anything that changes what should be visible (workspace switch, config change) — re-derives rootGroups from scratch, honoring an in-progress text filter if there is one. */
    private async refreshTree (): Promise<void> {
        const applied = await this.loadTreeItems()
        if (applied && this.filter.trim()) {
            await this.onFilterChange()
        }
    }

    /**
     * Opens the Renommer/Icône/Couleur/Copier/Supprimer menu for one
     * workspace, anchored at `event.clientX/Y`. One call site in the .pug: a
     * tab's own `(contextmenu)` in tabs mode, where at-the-cursor is the OS
     * convention. List mode goes through openWorkspaceMenuFromSwitcher()
     * below instead — same menu, fixed anchor.
     *
     * List mode does *not* wire this to a row's `(contextmenu)` either —
     * tried and reported unreliable in testing (2026-08-07), reverted
     * without a live repro to confirm the exact mechanism. The prime
     * suspect: the row that received the `contextmenu` event sat inside the
     * switcher popup, which (as a contextMenuMode value at the time) was
     * torn down by the very mutation its own handler made; the incoming
     * workspaceMenu popup shares the plain `.group-context-menu` class that
     * `document.querySelector()` in clampContextMenuPosition() matches on.
     * Same *kind* of outgoing-vs-incoming ambiguity as piège #30. The
     * switcher no longer being a mode removes the teardown half of that
     * race, but the right-click stays unwired: the "⋯" button is the one
     * documented entry, and it is a plain click with nothing to race.
     */
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

    /**
     * Toggles the workspace list popup that stands in for `.workspace-bar`
     * in 'dropdown' mode (see workspaceSelectorMode). Anchored to the compact
     * bar itself, never to the click position: the popup replaces the tab
     * strip, so it belongs under the control that opened it, and reopening it
     * must land in the same place every time (user request, 2026-08-07 —
     * fixed positions, not wherever the mouse happened to be).
     *
     * Left-click on an entry calls selectWorkspace(), which closes the popup
     * as its terminal action. Managing a workspace (Renommer/Icône/Couleur/
     * Copier/Supprimer) goes through each row's own "⋯" button, wired to
     * openWorkspaceMenuFromSwitcher() — which opens NEXT to this popup and
     * leaves it on screen underneath.
     */
    openWorkspaceSwitcher (event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        if (this.workspaceSwitcherOpen) {
            this.workspaceSwitcherOpen = false
            return
        }
        const bar = (event.currentTarget as HTMLElement).getBoundingClientRect()
        this.workspaceSwitcherX = Math.round(bar.left)
        this.workspaceSwitcherY = Math.round(bar.bottom + 2)
        this.workspaceSwitcherOpen = true
    }

    /**
     * Where popups spawned FROM the switcher anchor: flush against its right
     * edge, level with its top. One fixed spot for every "⋯" row and for
     * "Nouveau workspace...", so a manage flow reads as a stable second
     * column next to the list instead of hopping to wherever each click
     * landed. The sub-popups a manage flow then opens (rename, colour,
     * delete…) never touch contextMenuX/Y, so they inherit the same spot.
     * Falls back to the switcher's own anchor if the popup is somehow not in
     * the DOM; ngAfterViewChecked's clamp pulls it back on-screen when the
     * right edge has no room.
     */
    private switcherPopupAnchor (): { x: number, y: number } {
        const popup = document.querySelector<HTMLElement>('.workspace-switcher-menu')
        const rect = popup?.getBoundingClientRect()
        return rect
            ? { x: Math.round(rect.right + 4), y: Math.round(rect.top) }
            : { x: this.workspaceSwitcherX, y: this.workspaceSwitcherY }
    }

    /** The switcher-side twin of onWorkspaceTabContextMenu(): same menu, fixed anchor beside the list, list kept open underneath. */
    openWorkspaceMenuFromSwitcher (event: MouseEvent, workspace: SidebarWorkspace): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuGroup = null
        this.contextMenuProfile = null
        this.contextMenuRoot = false
        this.contextMenuWorkspace = workspace
        this.contextMenuMode = 'workspaceMenu'
        const anchor = this.switcherPopupAnchor()
        this.contextMenuX = anchor.x
        this.contextMenuY = anchor.y
        this.menuPositionDirty = true
    }

    /** The switcher-side twin of openCreateWorkspacePrompt(), same fixed anchor as the manage menu. */
    openCreateWorkspaceFromSwitcher (event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuWorkspace = null
        this.contextMenuMode = 'createWorkspace'
        this.newWorkspaceName = ''
        const anchor = this.switcherPopupAnchor()
        this.contextMenuX = anchor.x
        this.contextMenuY = anchor.y
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

    /**
     * "Importer du presse-papiers", from the workspace creation popup.
     *
     * Nothing here trusts the payload — same discipline as `pasteGroup()`:
     * the JSON is clipboard text, hand-editable, and only checked on the way
     * in (`parseWorkspacePayload()`). The id is always minted fresh
     * (`generateWorkspaceId()`), never the one the payload carries, even when
     * it looks clean — reusing an id copied from another machine risks
     * colliding with one already in use locally.
     *
     * A name collision is silently suffixed rather than asked about, unlike a
     * folder paste: a workspace has no contents for "merge" to mean anything
     * against, it is a name plus a handful of exclusion/order lists, so there
     * is nothing to choose between beyond the name itself.
     *
     * Deliberately does not select the imported workspace — it lands in the
     * tab bar (via `refreshTree()`, which re-reads `this.workspaces` from
     * config without touching `activeWorkspaceId`) and waits to be clicked,
     * same as any workspace created by hand.
     */
    async importWorkspaceFromClipboard (): Promise<void> {
        const { payload, error } = parseWorkspacePayload(this.platform.readClipboard())
        if (!payload) {
            this.notices.error(error ? this.tMsg(error) : this.i18n.t('The clipboard does not hold an exported workspace.'))
            return
        }
        this.config.store.sidebarPlus ??= {}
        const workspaces: SidebarWorkspace[] = this.config.store.sidebarPlus.workspaces ?? []
        const name = uniqueWorkspaceName(payload.workspace.name?.trim() || this.i18n.t('Imported workspace'), workspaces.map(w => w.name))
        const created: SidebarWorkspace = {
            id: generateWorkspaceId(),
            name,
            hiddenProfileIds: payload.workspace.hiddenProfileIds,
            hiddenGroupIds: payload.workspace.hiddenGroupIds,
            favorites: payload.workspace.favorites,
            favoriteGroups: payload.workspace.favoriteGroups,
            groupOrder: payload.workspace.groupOrder,
            profileOrder: payload.workspace.profileOrder,
        }
        if (payload.workspace.icon !== undefined) {
            created.icon = payload.workspace.icon
        }
        if (payload.workspace.color !== undefined) {
            created.color = payload.workspace.color
        }
        workspaces.push(created)
        this.config.store.sidebarPlus.workspaces = workspaces
        await this.config.save()
        this.closeContextMenu()
        await this.refreshTree()
        this.notices.notice(this.i18n.t('Workspace "{name}" imported.', { name }))
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

    /**
     * "Copier (JSON)", from a workspace tab's context menu.
     *
     * Exports everything the workspace carries except its id — an id is
     * always minted fresh on import (`generateWorkspaceId()`), exactly like a
     * pasted folder's own id. No purge level to choose between, unlike
     * `copyGroupStructure()`: a workspace holds only ids (an exclusion list
     * and a couple of order maps), never a profile's `options`, so there is
     * nothing secret in it to begin with.
     */
    async copyWorkspace (): Promise<void> {
        const workspace = this.contextMenuWorkspace
        this.closeContextMenu()
        if (!workspace) {
            return
        }
        const payload = buildWorkspacePayload(workspace)
        this.platform.setClipboard({ text: JSON.stringify(payload, null, 2) })
        this.notices.notice(this.i18n.t('Workspace "{name}" copied.', { name: workspace.name }))
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

    ////// PER-BLOCK SWITCHES //////
    /**
     * Whether each block of the sidebar is on.
     *
     * Two independent reasons a block can be off, deliberately combined here
     * rather than at each call site: the user unticked it, or the host no
     * longer carries it (`hostSupports`, see hostCompat.ts). Callers only ever
     * want the conjunction, and splitting it would guarantee that one of the
     * twenty-odd usages eventually forgets the second half.
     *
     * These are getters, not fields: `config.store` is the single source of
     * truth and `config.changed$` already rebuilds the view, so caching them
     * would only add a way for the two to disagree. They are read from the
     * template on every change detection pass, which is fine — each is a
     * property lookup, not the method call of piège #54.
     */
    get showActiveSessions (): boolean {
        return (this.config.store.sidebarPlus?.showActiveSessions ?? true) && hostSupports('ssh-tab')
    }

    /**
     * No `hostSupports(...)` gate, unlike its neighbours: a relaunch is a
     * generic profile action (SSH, local, whatever a provider offers), not
     * tied to the SSH tab or the SFTP panel the other blocks depend on.
     */
    get showRecentProfiles (): boolean {
        return this.config.store.sidebarPlus?.showRecentProfiles ?? true
    }

    get showTunnels (): boolean {
        return (this.config.store.sidebarPlus?.showTunnels ?? true) && hostSupports('ssh-tab')
    }

    get showSftp (): boolean {
        return (this.config.store.sidebarPlus?.showSftp ?? true) && hostSupports('sftp-panel')
    }

    /**
     * The transfers panel, which belongs to the SFTP view and is switched off
     * with it.
     *
     * Subordinate rather than independent because that is where transfers come
     * from in practice, and because the settings page groups an option with the
     * feature it belongs to. The nuance to keep in mind: the registry also
     * mirrors transfers *this plugin did not start* — the native SFTP panel's,
     * another plugin's — and those become invisible here when the SFTP view is
     * off. That is why switching it off also stops hiding Tabby's own transfers
     * menu (see SidebarPlusMountService): the plugin must not hide the host's
     * only remaining readout of something it no longer shows itself.
     */
    get showTransfers (): boolean {
        return this.showSftp && (this.config.store.sidebarPlus?.showTransfers ?? true)
    }

    get showWorkspaces (): boolean {
        return this.config.store.sidebarPlus?.showWorkspaces ?? true
    }

    get showFilter (): boolean {
        return this.config.store.sidebarPlus?.showFilter ?? true
    }

    get showSnippets (): boolean {
        return this.config.store.sidebarPlus?.showSnippets ?? true
    }

    get showNotes (): boolean {
        return this.config.store.sidebarPlus?.showNotes ?? true
    }

    /**
     * Puts the sidebar back into a coherent state after a block is switched
     * off, so that nothing keeps acting through a control that is gone.
     *
     * Called from the `config.changed$` path. Each case is a state that would
     * otherwise be unreachable *and* unexplainable: a workspace still filtering
     * the tree with no tab bar to switch away from it, a filter still hiding
     * rows with no field showing why, an SFTP view with no way back to the
     * profiles.
     */
    private reconcileHiddenBlocks (): void {
        if (!this.showSftp && this.sftpMode) {
            this.sftpMode = false
        }
        if (this.showWorkspaces) {
            // Coming back on: restore the selection the user last made, which
            // the branch below deliberately left in localStorage.
            const remembered = window.localStorage.sidebarPlusActiveWorkspace ?? 'all'
            if (this.activeWorkspaceId !== remembered) {
                this.activeWorkspaceId = remembered
            }
        } else {
            // Falling back to "Tous" — the zero-exclusion case, so this reveals
            // everything rather than hiding more.
            //
            // Assigned directly and *not* through selectWorkspace(), which
            // would write 'all' to localStorage: switching a block off must
            // never overwrite a choice the user made. The stored workspaces are
            // untouched either way, but their selection is a choice too, and
            // losing it on a round trip through the switch would be exactly the
            // silent overwrite this must not do.
            if (this.activeWorkspaceId !== 'all') {
                this.activeWorkspaceId = 'all'
            }
            if (this.showHiddenPanel) {
                this.showHiddenPanel = false
            }
        }
        if (!this.showFilter && this.filter) {
            this.filter = ''
            void this.onFilterChange()
        }
    }

    ////// SFTP VIEW //////
    setSftpMode (on: boolean): void {
        if (on && !this.showSftp) {
            return
        }
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
    /**
     * Folder whose own profile list the dragged profile is currently over —
     * feeds isNestTarget() below, kept apart from hoveredProfileId (which
     * drives *where in the list* it lands, not *which folder*). Set from
     * CDK's own (cdkDropListEntered)/(cdkDropListExited) on that list rather
     * than a live hit-test: unlike the folder-on-folder case there is no
     * upper/lower-half ambiguity to rescue here, CDK already resolves this
     * container correctly.
     */
    private hoveredProfileTargetGroupId: string|null = null
    /** The folder the dragged profile started in, captured once at drag start — tells a genuine cross into another folder apart from re-entering its own list. */
    private draggedProfileSourceGroupId: string|null = null

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
                name: this.i18n.t('Pinned'),
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
        const wantSessions = this.showActiveSessions
        const wantTunnels = this.showTunnels

        // Kept outside the early return below: it is a plain per-tab pass, not
        // the per-split forward scan that return exists to skip, and the
        // transfer arrows are a property of the profile row itself — they do
        // not depend on the "Sessions actives"/"Tunnels" blocks being shown.
        const sessionLabelToProfileId = new Map<string, string>()
        for (const tab of getAllOpenTabs(this.app)) {
            if (!isSSHTab(tab) || !isLiveSSHTab(tab)) {
                continue
            }
            const profile = (tab as unknown as ProfileBackedTab).profile
            if (!profile?.id) {
                continue
            }
            // Same precedence as sftpPanel.component.ts's own `sessionLabel`
            // assignment — the string a transfer's `TransferEntry.sessionLabel`
            // was stamped with at registration, so this map is the join back.
            const renamedTitle = tab.customTitle || tab.topmostParent?.customTitle
            const sessionName = renamedTitle || profile.name || tab.title || 'Session SSH'
            sessionLabelToProfileId.set(sessionName, profile.id)
        }
        this.sessionLabelToProfileId = sessionLabelToProfileId
        this.refreshTransferActivity()

        if (!wantSessions && !wantTunnels) {
            // Neither block is on: this whole scan — every tab of every split,
            // twice a second — produces nothing anybody can see. Drop what was
            // already collected so switching a block back on starts from a
            // clean slate rather than from a stale snapshot.
            if (this.activeSessions.length) {
                this.activeSessions = []
            }
            if (this.activeTunnels.length) {
                this.activeTunnels = []
            }
            this.tunnelCounts = new Map()
            this.liveTunnelKeys = new Map()
            // A stale memory would resurrect "waiting" rows the moment the
            // block comes back on, for sessions that may be long gone.
            this.tunnelMemory.clear()
            return
        }

        const focused = this.resolveFocusedTab()
        const sessions: ActiveSession[] = []
        const tunnels: ActiveTunnel[] = []
        const tunnelCounts = new Map<string, number>()
        const liveTunnelKeys = new Map<string, Set<string>>()
        const nowMs = Date.now()
        const openSSHTabs = new Set<SSHTabComponent>()
        // A multiplexed session is one object shared by several tabs, so its
        // forwards would otherwise be listed once per tab: same object, same
        // tunnel, N lines for one listener.
        const seenForwards = new Set<LiveForward>()
        // First mounted wins for a local listener — see the dedup note below.
        const localOwners = new Map<string, string>()
        for (const tab of getAllOpenTabs(this.app)) {
            // Same narrowing as the SFTP panel, through the same helper: it
            // only holds while `tabby-ssh` stays out of node_modules
            // (src/types/tabby-ssh/PROVENANCE.md, piège #34), and isSSHTab()
            // is where that assumption is checked rather than assumed.
            if (!isSSHTab(tab)) {
                continue
            }
            openSSHTabs.add(tab)
            // Both halves of the test matter — see isLiveSSHTab and piège #37.
            // Shared with the SFTP panel since 2026-08-02: the two had drifted
            // apart, this list dropping a session the panel went on serving.
            if (!isLiveSSHTab(tab)) {
                // The tab still exists but its transport is gone: this is the
                // very window a reconnection happens in. Its tunnels are shown
                // from memory, dimmed, rather than silently dropped — a section
                // that vanishes during a micro-cut is indistinguishable from
                // one that never had tunnels.
                if (wantTunnels) {
                    this.pushWaitingTunnels(tab, tunnels, nowMs)
                }
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
            // Computed above regardless because the tunnel rows label
            // themselves with it, but only collected when the sessions block is
            // on: `sessions` is also what the latency probe is handed below, so
            // filling it for a hidden block would keep sending real requests to
            // real servers for a list nobody can see.
            if (wantSessions) {
                sessions.push({
                    tab,
                    name: sessionName,
                    icon: profile?.icon || tab.icon || 'fas fa-terminal',
                    color: profile?.color ?? tab.color ?? null,
                    title: tab.title,
                    focused: tab === focused,
                    // Filled in by refreshSessionTransfers() below, whichever
                    // array (this fresh one or the kept-in-place previous one)
                    // ends up as this.activeSessions — placeholder only.
                    transferCount: 0,
                    transferSpeedLabel: '',
                    transferLabel: '',
                })
            }

            if (!wantTunnels) {
                continue
            }
            // Read straight off the live transport. Tabby owns the forwarding
            // engine entirely — this plugin only mirrors its state, per the
            // roadmap's "surcouche visuelle" framing.
            const tabRows: ActiveTunnel[] = []
            for (const forward of tab.sshSession.forwardedPorts ?? []) {
                if (seenForwards.has(forward)) {
                    continue
                }
                seenForwards.add(forward)
                const key = tunnelKey(forward)
                // Real duplicate: two *distinct* sessions each mounted the same
                // forward — several tabs on one profile do exactly that, since
                // every session start replays the profile's list, and Windows
                // lets a second listener bind a port Unix would refuse. Only
                // one of them usefully serves; the first mounted is kept and
                // the copy is dismounted, with a notice. Remote forwards are
                // exempt: they listen on *their* server's side, so the same
                // key on two sessions to two hosts is two different tunnels —
                // and on the same host the server already refused the second.
                if (forward.type !== PortForwardType.Remote) {
                    const owner = localOwners.get(key)
                    if (owner !== undefined) {
                        this.dismountDuplicate(tab, forward, owner, sessionName)
                        continue
                    }
                    localOwners.set(key, sessionName)
                }
                const detail = formatTunnel(forward)
                tabRows.push({
                    tab,
                    sessionName,
                    label: forward.description?.trim() || detail,
                    detail,
                    url: SidebarPlusTreeComponent.tunnelUrl(forward),
                    state: 'live',
                    tooltip: detail,
                    key,
                })
                if (profile?.id) {
                    tunnelCounts.set(profile.id, (tunnelCounts.get(profile.id) ?? 0) + 1)
                    const keys = liveTunnelKeys.get(profile.id) ?? new Set<string>()
                    keys.add(key)
                    liveTunnelKeys.set(profile.id, keys)
                }
            }
            tunnels.push(...tabRows)
            this.rememberTunnels(tab, tabRows, tunnels, nowMs)
        }
        // Tabs that no longer exist take their memory with them: a closed tab
        // is a closed session, not a cut waiting to heal.
        for (const tab of [...this.tunnelMemory.keys()]) {
            if (!openSSHTabs.has(tab)) {
                this.tunnelMemory.delete(tab)
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

        // Refreshes the compact transfer segment on whichever array is now
        // current — see refreshSessionTransfers() for why this mutates the
        // existing ActiveSession objects rather than relying on the block
        // above to have swapped in fresh ones.
        this.refreshSessionTransfers()
    }

    /**
     * Recomputes each active session's transfer aggregate: how many of the
     * registry's `active` entries carry this session's own name as their
     * `sessionLabel`, and their combined speed — G5's plain-string join
     * (`entry.sessionLabel === session.name`), no profile id involved.
     *
     * Mutates the existing `ActiveSession` objects **in place** rather than
     * going through `this.activeSessions = …`: that reassignment is gated by
     * `sameSessions()` precisely to keep the array's identity stable across
     * the 2s poll, so that `*ngFor` does not tear down and rebuild every row
     * — which would drop the `:hover` state `.actions` lives in (see the
     * comment above `sameSessions()`). A transfer's speed moves on the
     * registry's own 500 ms tick, far more often than that guard would
     * tolerate if these fields were part of what it compares; mutating the
     * fields on the objects that are already there sidesteps the question
     * entirely, the same way the registry itself mutates `TransferEntry`
     * fields in place instead of replacing `entries`.
     *
     * Called from refreshActiveSessions() (2s cadence — plenty for ambient
     * reading, deliberately not the registry's own 500 ms tick) and from the
     * registry's `changed` event, so a transfer starting or ending shows up
     * without waiting up to 2s. The speed shown here can therefore trail the
     * transfers panel's own figure by up to 2s — accepted, and worth saying
     * here rather than leaving it to look like a bug: this is a row glanced
     * at in passing, not the panel itself.
     */
    private refreshSessionTransfers (): void {
        if (!this.showTransfers) {
            for (const session of this.activeSessions) {
                if (session.transferCount !== 0) {
                    session.transferCount = 0
                    session.transferSpeedLabel = ''
                    session.transferLabel = ''
                }
            }
            return
        }
        const bySessionName = new Map<string, { count: number, speed: number }>()
        for (const entry of this.transfers.entries) {
            if (entry.state !== 'active' || !entry.sessionLabel) {
                continue
            }
            const agg = bySessionName.get(entry.sessionLabel) ?? { count: 0, speed: 0 }
            agg.count++
            agg.speed += entry.speed
            bySessionName.set(entry.sessionLabel, agg)
        }
        for (const session of this.activeSessions) {
            const agg = bySessionName.get(session.name)
            session.transferCount = agg?.count ?? 0
            session.transferSpeedLabel = agg ? formatSpeed(agg.speed) : ''
            session.transferLabel = session.transferCount > 0
                ? `${session.transferCount} ⇅${session.transferSpeedLabel ? ` ${session.transferSpeedLabel}` : ''}`
                : ''
        }
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
        const line = [
            session.name,
            latency === null ? null : `${latency} ms`,
            this.formatUptimePrecise(this.uptimeMs(session)),
        ].filter(Boolean).join(' | ')
        // A second line, only when there is something to say — the native
        // `title` attribute renders `\n` as an actual line break (same as
        // TransferEntry.tooltip in transfersRegistry.service.ts), so this
        // does not have to fight the ' | '-joined line above for room.
        if (session.transferCount <= 0) {
            return line
        }
        const transfersLine = session.transferSpeedLabel
            ? this.i18n.t('Transfers: {count} running, total speed {speed}', { count: session.transferCount, speed: session.transferSpeedLabel })
            : this.i18n.t('Transfers: {count} running', { count: session.transferCount })
        return `${line}\n${transfersLine}`
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
        return elapsed === null ? '' : this.formatUptime(elapsed)
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
    private formatUptimePrecise (ms: number|null): string {
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
        // Only the day unit varies with the language ("2j" in French, "2d" in
        // English) — the s/m/h forms above are cross-language.
        return this.i18n.t('{d}d {h}h', { d: Math.floor(hours / 24), h: String(hours % 24).padStart(2, '0') })
    }

    /** `42 s`, `12 min`, `3 h 05`, `2 j 4 h` — coarser as it gets longer, since a session's age is read at a glance. */
    private formatUptime (ms: number): string {
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
        // Same reasoning as formatUptimePrecise(): only the day unit is
        // language-bound.
        return this.i18n.t('{d} d {h} h', { d: Math.floor(hours / 24), h: hours % 24 })
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
    /** Whether this configured tunnel is one Tabby currently has mounted — the only kind whose deletion is withheld. */
    isTunnelLive (forward: ForwardedPortConfig, profileId: string|undefined): boolean {
        if (!profileId) {
            return false
        }
        return this.liveTunnelKeys.get(profileId)?.has(tunnelKey(forward)) ?? false
    }

    private static sameTunnels (a: ActiveTunnel[], b: ActiveTunnel[]): boolean {
        return a.length === b.length && a.every((tunnel, i) =>
            tunnel.tab === b[i].tab &&
            tunnel.label === b[i].label &&
            tunnel.detail === b[i].detail &&
            tunnel.url === b[i].url &&
            tunnel.sessionName === b[i].sessionName &&
            tunnel.state === b[i].state)
    }

    /**
     * What each SSH tab's tunnels looked like when last seen alive, kept across
     * the death of the session so a micro-cut shows as a state instead of a
     * disappearance. Pruned when the tab itself goes away.
     */
    private tunnelMemory = new Map<SSHTabComponent, TunnelMemoryEntry>()

    /** Forwards already dismounted as duplicates — the poll must not notice (or dismount) them twice while the removal is in flight. */
    private dismountedForwards = new WeakSet<LiveForward>()

    /** Emits the remembered tunnels of a dead-but-present tab, dimmed, while the reconnection window lasts. */
    private pushWaitingTunnels (tab: SSHTabComponent, into: ActiveTunnel[], now: number): void {
        const entry = this.tunnelMemory.get(tab)
        if (!entry?.rows.length) {
            return
        }
        entry.lostAt ??= now
        if (now - entry.lostAt > TUNNEL_LOSS_GRACE_MS) {
            // Nobody revived it in time: from here on the cut is treated as a
            // closure, and the rows go the way they always did before this
            // feature — away.
            this.tunnelMemory.delete(tab)
            return
        }
        for (const row of entry.rows) {
            into.push({
                tab,
                sessionName: row.sessionName,
                label: row.label,
                detail: row.detail,
                // No browser button on a dead listener: the page could not load.
                url: null,
                state: 'waiting',
                tooltip: this.i18n.t('{detail}: session cut, tunnel waiting to resume', { detail: row.detail }),
                key: row.key,
            })
        }
    }

    /**
     * Updates the memory of a live tab, and surfaces what a revival did *not*
     * bring back.
     *
     * Tabby only remounts the forwards written on the profile — a tunnel added
     * on the fly through the modal is silently gone after a reconnection
     * (verified in the installed app's `ssh.ts`: `start()` replays
     * `profile.options.forwardedPorts`, nothing else). Those are shown as
     * `lost` for a while, so the silence has a witness.
     */
    private rememberTunnels (tab: SSHTabComponent, live: ActiveTunnel[], into: ActiveTunnel[], now: number): void {
        const previous = this.tunnelMemory.get(tab)
        let ghosts = previous?.ghosts ?? []
        if (previous && previous.lostAt !== null) {
            const liveKeys = new Set(live.map(row => row.key))
            ghosts = previous.rows.filter(row => !liveKeys.has(row.key)).map(row => ({
                row: {
                    tab,
                    sessionName: row.sessionName,
                    label: row.label,
                    detail: row.detail,
                    url: null,
                    state: 'lost' as const,
                    tooltip: this.i18n.t(
                        '{detail}: not restored after the reconnection. Only the tunnels saved in the profile are remounted; a tunnel added on the fly disappears with its session.',
                        { detail: row.detail },
                    ),
                    key: row.key,
                },
                until: now + TUNNEL_NOT_RESTORED_MS,
            }))
        }
        // The same row objects are re-pushed every pass on purpose: their
        // fields are what sameTunnels() compares, and stable rows are what
        // keeps the DOM from being rebuilt twice a second.
        ghosts = ghosts.filter(ghost => ghost.until > now)
        into.push(...ghosts.map(ghost => ghost.row))
        this.tunnelMemory.set(tab, {
            rows: live.map(row => ({ key: row.key, sessionName: row.sessionName, label: row.label, detail: row.detail })),
            lostAt: null,
            ghosts,
        })
    }

    /**
     * Dismounts one duplicate forward and says so.
     *
     * Fire-and-forget on purpose: this runs inside the 2 s poll, and the poll
     * must not await network round trips. The WeakSet is what keeps the next
     * pass from dismounting (or announcing) the same object again while the
     * removal is still in flight.
     */
    private dismountDuplicate (tab: SSHTabComponent, forward: LiveForward, ownerName: string, sessionName: string): void {
        if (this.dismountedForwards.has(forward)) {
            return
        }
        this.dismountedForwards.add(forward)
        const detail = formatTunnel(forward)
        tab.sshSession?.removePortForward(forward).catch(() => {
            // The listener may already be gone with its session; either way the
            // next poll re-reads reality rather than trusting this call.
        })
        this.notices.notice(
            this.i18n.t('Tunnel {detail} already mounted by {owner}: duplicate dismounted ({session})', { detail, owner: ownerName, session: sessionName }),
        )
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

    ////// TRANSFER ACTIVITY ARROWS //////
    /** Backs the ↑/↓ badge in the tree — read from the precomputed map, never scanning the registry here (piège #54). */
    transferActivity (profile: PartialProfile<Profile>): { up: boolean, down: boolean }|null {
        return (profile.id && this.profileActivity.get(profile.id)) || null
    }

    /**
     * Recomputes profileId → {up, down} from the registry's entries and the
     * sessionLabel → profileId map refreshActiveSessions() just rebuilt.
     *
     * Called on every `changed` event from the registry (an entry starting or
     * leaving `active`) and every `refreshActiveSessions()` pass (a session's
     * label may now resolve, or no longer). Not a getter: the row for every
     * profile in the tree would otherwise rescan the whole registry on every
     * change detection pass.
     */
    private refreshTransferActivity (): void {
        // `showTransfers` is this component's own mirror of the registry's
        // `enabled` (it additionally gates on `hostSupports`) — the switch
        // that is supposed to cut the source, not just the view. The registry
        // itself already declines to track *new* entries while off; this is
        // what keeps an arrow from lingering, drawn from an entry that was
        // already active when the switch flipped.
        if (!this.showTransfers) {
            if (this.profileActivity.size) {
                this.profileActivity = new Map()
            }
            return
        }
        const activity = new Map<string, { up: boolean, down: boolean }>()
        for (const entry of this.transfers.entries) {
            if (entry.state !== 'active' || !entry.sessionLabel) {
                continue
            }
            const profileId = this.sessionLabelToProfileId.get(entry.sessionLabel)
            if (!profileId) {
                continue
            }
            const row = activity.get(profileId) ?? { up: false, down: false }
            if (entry.direction === 'up') {
                row.up = true
            } else {
                row.down = true
            }
            activity.set(profileId, row)
        }
        this.profileActivity = activity
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

    ////// PROFILE TUNNEL CONFIGURATION (modal) //////
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
     *
     * The form itself — draft, validation, add/edit/remove — lives in
     * `TunnelsModalComponent` (a centred modal, like the snippets and note
     * editors) rather than in the anchored popup it used to be. What stays
     * here is what the modal cannot know on its own: whether a given forward
     * is one Tabby currently has mounted (`isTunnelLive`, fed by the same
     * poll that drives the tree's own "Tunnels actifs" section) and whether
     * the profile has a live session at all — both handed to the modal as
     * callbacks bound to `profile` below, rather than as a one-time snapshot,
     * so they stay accurate even if a session opens or closes while the modal
     * is open.
     */
    /** Port forwarding is an SSH-profile notion — the menu entries stay hidden on local/serial/telnet profiles rather than offering a setting Tabby would ignore. */
    get isSshProfileMenu (): boolean {
        return this.contextMenuProfile?.type === 'ssh'
    }

    async openProfileTunnels (): Promise<void> {
        const profile = this.contextMenuProfile
        this.closeContextMenu()
        if (!profile) {
            return
        }
        const modal = this.ngbModal.open(TunnelsModalComponent, { size: 'lg' })
        modal.componentInstance.profile = profile
        modal.componentInstance.isLive = (forward: ForwardedPortConfig) => this.isTunnelLive(forward, profile.id)
        modal.componentInstance.hasLiveSession = () => !!this.connectedTabForProfile(profile)
        await modal.result.catch(() => null)
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
        // A freeze left over from an earlier navigation must not swallow
        // this click: naming one particular session here is a more explicit
        // gesture than the pin it might be overriding, and letting the pin
        // win would make the shortcut silently do nothing. Unfreeze before
        // focusTab() — sync() runs off the resulting focus change, so the
        // panel is free to follow by the time it fires.
        this.sftpPanel?.unfreeze()
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
        const where = targetGroup.name || this.i18n.t('No group')
        this.clearSelection()
        this.showSelectionNotice(
            moves.length > 1
                ? this.i18n.t('{count} profiles moved to "{where}"', { count: moves.length, where })
                : this.i18n.t('Profile moved to "{where}"', { where }),
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
        this.draggedProfileSourceGroupId = profile.group ?? 'ungrouped'
        this.hoveredProfileTargetGroupId = null
    }

    /**
     * Releases the tracking only — `hoveredProfileId` is deliberately kept, for
     * the same reason as onGroupDragEnded(): CDK emits `cdkDragEnded` *before*
     * `cdkDropListDropped` (piège #29), so clearing it here would wipe the value
     * a moment before the drop handler reads it.
     *
     * `hoveredProfileTargetGroupId` has no such reader downstream — it only
     * drives the nest highlight — so it is safe to clear right away.
     */
    onProfileDragEnded (): void {
        this.draggedProfileId = null
        this.hoveredProfileTargetGroupId = null
    }

    /**
     * CDK fires this on a folder's own profile list when the dragged profile's
     * pointer crosses into it — not for the list the drag started in, only for
     * a genuine move into a different container — which is exactly "this
     * folder is about to receive it". `zone.run()` guards against CDK's
     * pointer tracking running outside NgZone (piège #41): its own
     * `dropped`/`started`/`ended` outputs already re-enter the zone and are
     * relied upon elsewhere in this file, but this pair is new here.
     */
    onProfileListEntered (group: PartialProfileGroup<CollapsableProfileGroup>): void {
        this.zone.run(() => {
            this.hoveredProfileTargetGroupId = group.id
        })
    }

    onProfileListExited (group: PartialProfileGroup<CollapsableProfileGroup>): void {
        this.zone.run(() => {
            if (this.hoveredProfileTargetGroupId === group.id) {
                this.hoveredProfileTargetGroupId = null
            }
        })
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

    /**
     * Whether `group`'s row should carry the "drop inside" highlight right
     * now, as opposed to CDK's own reorder feedback. Purely a read of state
     * already tracked for other purposes — `hoveredGroupId`/`draggedGroupId`
     * drive the folder-on-folder rescue below, `hoveredProfileTargetGroupId`
     * tracks a profile crossing into a foreign folder — so this adds no new
     * hit-testing, and the class it feeds (`.sidebar-plus-nest-target`) is
     * background/outline only: no geometry (piège #25/#28).
     *
     * `isSelfOrDescendant` is declared further down the file; order does not
     * matter for class members.
     */
    isNestTarget (group: PartialProfileGroup<CollapsableProfileGroup>): boolean {
        if (this.draggedGroupId) {
            return this.hoveredGroupId === group.id &&
                group.id !== this.draggedGroupId &&
                !!group.editable &&
                !this.isSelfOrDescendant(group.id, this.draggedGroupId)
        }
        if (this.draggedProfileId) {
            return this.hoveredProfileTargetGroupId === group.id &&
                group.id !== this.draggedProfileSourceGroupId &&
                (!!group.editable || group.id === 'ungrouped')
        }
        return false
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
        const allGroups = await readProfileGroups(this.profilesService, this.config)
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
            this.notifications.error(this.i18n.t('Moving the folder failed'), String(err))
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

        // Attachments, variables and behaviour of that id — the library itself
        // is deliberately untouched, see the service.
        this.snippets.forget(id)
        this.moveNote(id, null)

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

        // Snippet attachments, variables and behaviour, keyed by the folder's
        // id. Forgotten here, dragging a folder into another would silently
        // strip it of its snippets — and of every snippet its profiles
        // inherited from it.
        this.snippets.migrate(oldId, newId)
        this.moveNote(oldId, newId)

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
        this.resetSubmenu()
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
        this.resetSubmenu()
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
        this.resetSubmenu()
    }

    /**
     * Opens the given lateral submenu beside the entry that carries it — both
     * hover and click call this. Anchored on the CARRYING ENTRY's own rect
     * (not a fixed point), so clampSubmenuPosition() can later flip the panel
     * to the entry's left once the panel's real width is known.
     */
    openSubmenuPanel (name: 'manage'|'more', event: MouseEvent): void {
        this.cancelSubmenuClose()
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        this.submenuAnchorLeft = rect.left
        this.submenuAnchorRight = rect.right
        this.submenuAnchorTop = rect.top
        this.activeSubmenu = name
        this.submenuX = rect.right
        this.submenuY = rect.top
        this.submenuPositionDirty = true
    }

    /** Cancels a pending submenu close — the pointer made it from the carrying entry onto the panel (or onto another submenu-carrying entry) before scheduleSubmenuClose()'s delay ran out. */
    cancelSubmenuClose (): void {
        if (this.submenuCloseTimer) {
            clearTimeout(this.submenuCloseTimer)
            this.submenuCloseTimer = null
        }
    }

    /** Closes the open submenu after a short delay instead of immediately, so the pointer's path from the carrying entry to the panel beside it (which briefly leaves both) doesn't make it vanish underfoot. */
    scheduleSubmenuClose (): void {
        this.cancelSubmenuClose()
        this.submenuCloseTimer = setTimeout(() => {
            this.submenuCloseTimer = null
            this.activeSubmenu = null
        }, 180)
    }

    /** The submenu dies with whatever menu carries it — called from closeContextMenu() and from every place that opens a fresh menu directly (a right-click elsewhere never goes through closeContextMenu() first). */
    private resetSubmenu (): void {
        this.cancelSubmenuClose()
        this.activeSubmenu = null
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
        // The switcher survives clicks inside ANY popup — the "⋯" menu and
        // its sub-popups all render beside it and act on it, so a click in
        // them is part of the same interaction. It dies only on a truly
        // outside click, checked here BEFORE the popup guard below returns
        // early. The compact bar is excluded so its own toggle stays the one
        // in charge of open/close (piège #15: its stopPropagation() cannot be
        // trusted to keep this HostListener from firing).
        if (!target.closest('.workspace-switcher-menu, .workspace-bar-compact, .group-context-menu, .group-context-submenu, .create-popup')) {
            this.workspaceSwitcherOpen = false
        }
        // .group-context-submenu (the Manage/More lateral panels) is a
        // sibling of .group-context-menu in the DOM, never a descendant of it
        // (piège #38: its entries are <a>, so the panel can't nest inside the
        // carrying entry's own <a> without the parser silently un-nesting
        // it) — so it needs its own entry here, not just an implicit catch
        // via the menu's. Left out, opening a submenu closes the whole menu
        // from under it (piège #15: stopPropagation() on its own click
        // binding does not stop this HostListener).
        if (target.closest('.group-context-menu, .group-context-submenu, .create-popup')) {
            return
        }
        this.closeContextMenu()
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
            // Minimal {id, name} object only — see IconPickerModalComponent's
            // applyIcon() for why (never pass contextMenuGroup itself, it
            // carries plugin-computed fields that writeProfileGroup() would
            // Object.assign() straight into config.yaml, roadmap piège #12).
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

        const modal = openProfileModal(this.ngbModal, base, entry.provider)
        if (!modal) {
            this.notifications.error(this.i18n.t(PROFILE_MODAL_UNAVAILABLE))
            return
        }

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
        this.resetSubmenu()
        this.contextMenuGroup = null
        this.contextMenuProfile = profile
        this.contextMenuRoot = false
        this.contextMenuMode = 'menu'
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
        this.menuPositionDirty = true
    }

    ////// ICON PICKER (modal) //////
    /**
     * Opens the icon picker on whichever of the three targets the current
     * menu carries — a profile, a folder, or (from the workspace menu) a
     * workspace, always exactly one. Everything the picker shows and writes
     * — search, favorites, recents, the custom-SVG import, the per-tile
     * favorite toggle — now lives in `IconPickerModalComponent`, a centred
     * modal like the snippets and note editors, rather than in the anchored
     * popup it used to be.
     */
    async openIconPicker (): Promise<void> {
        const profile = this.contextMenuProfile
        const group = this.contextMenuGroup
        const workspace = this.contextMenuWorkspace
        this.closeContextMenu()
        if (!profile && !group && !workspace) {
            return
        }
        const modal = this.ngbModal.open(IconPickerModalComponent, { size: 'lg' })
        modal.componentInstance.profile = profile
        modal.componentInstance.group = group
        modal.componentInstance.workspace = workspace
        await modal.result.catch(() => null)
    }

    ////// WORKSPACE COLOR (context menu) //////
    /**
     * Standard Tabby palette (TAB_COLORS, tabby-core/utils.ts) minus its own
     * "No color" entry — that one is offered separately below, as the
     * "Retirer la couleur" link mirroring clearWorkspaceIcon(), not folded
     * into the swatch grid. Re-labelled in French: TAB_COLORS' own `name`
     * fields are wrapped in `_()` for Tabby's own translation extraction and
     * come through unresolved ("Blue", "Green"...) since this plugin never
     * calls into that pipeline.
     */
    private static readonly WORKSPACE_COLOR_NAMES: Record<string, string> = {
        '#0275d8': 'Bleu',
        '#5cb85c': 'Vert',
        '#f0ad4e': 'Orange',
        '#613d7c': 'Violet',
        '#d9534f': 'Rouge',
        '#ffd500': 'Jaune',
    }

    get workspaceColors (): { name: string, value: string }[] {
        return TAB_COLORS
            .filter(c => c.value !== null)
            .map(c => ({
                name: SidebarPlusTreeComponent.WORKSPACE_COLOR_NAMES[c.value as string] ?? c.name,
                value: c.value as string,
            }))
    }

    openWorkspaceColorPicker (): void {
        this.contextMenuMode = 'workspaceColor'
        this.menuPositionDirty = true
    }

    async applyWorkspaceColor (color: string): Promise<void> {
        if (!this.contextMenuWorkspace) {
            return
        }
        // Same shape as confirmRenameWorkspace()/applyIcon(): find the live
        // entry in the stored array, mutate in place, then reassign the array
        // itself (piège #23 — a nested in-place mutation alone never persists).
        this.config.store.sidebarPlus ??= {}
        const workspaces: SidebarWorkspace[] = this.config.store.sidebarPlus.workspaces ?? []
        const target = workspaces.find(w => w.id === this.contextMenuWorkspace!.id)
        if (target) {
            target.color = color
        }
        this.config.store.sidebarPlus.workspaces = workspaces
        await this.config.save()
        this.closeContextMenu()
    }

    /** Mirrors IconPickerModalComponent.clearWorkspaceIcon() — deletes the field rather than storing an empty string, so every truthiness check on it (withWorkspaceColor()'s injection guard, the tab's color dot) stays a single `if (workspace.color)`. */
    async clearWorkspaceColor (): Promise<void> {
        if (!this.contextMenuWorkspace) {
            return
        }
        this.config.store.sidebarPlus ??= {}
        const workspaces: SidebarWorkspace[] = this.config.store.sidebarPlus.workspaces ?? []
        const target = workspaces.find(w => w.id === this.contextMenuWorkspace!.id)
        if (target) {
            delete target.color
        }
        this.config.store.sidebarPlus.workspaces = workspaces
        await this.config.save()
        this.closeContextMenu()
    }

    /**
     * Opens Tabby's own profile edit modal, exactly the way `tabby-settings`
     * opens it for its own list and `tabby-core` for the native tree: hand it a
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
     * That left two callers naming the modal's inputs by hand, which is what
     * `openProfileModal()` (`src/profileModal.ts`) now holds — one place to
     * assign them, one place to check they still exist.
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
            this.notifications.error(this.i18n.t('No provider handles "{name}": opening the settings', { name: profile.name }))
            this.openProfilesSettingsTab()
            return
        }

        // Never the live object: the modal mutates what it is handed, so a
        // cancelled edit would otherwise keep its changes — in the displayed
        // tree, and in `config.store` for anything reachable from it (piège
        // #12). tabby-settings and tabby-core's own tree both clone here too,
        // for the same reason.
        const modal = openProfileModal(this.ngbModal, structuredClone(profile), provider)
        if (!modal) {
            this.notifications.error(this.i18n.t(PROFILE_MODAL_UNAVAILABLE))
            return
        }

        const result = await modal.result.catch(() => null) as PartialProfile<Profile>|null
        if (!result) {
            return
        }
        result.type = provider.id
        await this.profilesService.writeProfile(result)
        await this.config.save()
    }

    ////// PROFILE DUPLICATION (context menu) //////
    /**
     * "Dupliquer" — a copy of the profile, in the same folder, named
     * "<name> - Copie".
     *
     * `structuredClone()` first, always: `newProfile()` pushes the very object
     * it is handed into `config.store.profiles`, so a shallow copy would leave
     * both entries sharing one `options` object — editing either would silently
     * edit the other. `contextMenuProfile` happens to be detached already
     * (`readProfileGroups()` clones the whole tree), and relying on that is
     * exactly the kind of assumption piège #12 is made of.
     *
     * `isBuiltin`/`isTemplate` are dropped like `pickProfileTemplate()` does: a
     * copy of a provider-contributed profile belongs to the user, and keeping
     * the flag would file it back under the synthetic "built-in" group, which
     * is not editable. Their `group` is a provider-declared *name*, not a real
     * group id, so it goes too — the copy lands in "Ungrouped", where the user
     * can pick it up.
     *
     * `weight` is kept on purpose: same rank as the original, and `sort()`
     * being stable, the copy lands right underneath it rather than at the end
     * of the folder. `id` is left alone — `newProfile()` overwrites it with a
     * fresh uuid derived from the new name.
     */
    async duplicateProfile (profile: PartialProfile<Profile>): Promise<void> {
        this.closeContextMenu()
        const copy = structuredClone(profile) as PartialProfile<Profile> & { isTemplate?: boolean, isBuiltin?: boolean }
        if (copy.isBuiltin) {
            delete copy.group
        }
        delete copy.isTemplate
        delete copy.isBuiltin
        copy.name = this.copyNameFor(profile)
        await this.profilesService.newProfile(copy)
        // The memo travels with the copy. Nothing carries it on its own — a
        // note is keyed by profile id, and `newProfile()` has just minted a new
        // one — yet duplicating a server to make a variant of it and losing
        // what one had written about it is the wrong default.
        this.copyNote(profile.id, copy.id)
        await this.config.save()
    }

    /**
     * "X" → "X - Copie", then "X - Copie 2", "X - Copie 3"… against the names
     * already in the same folder.
     *
     * The bare suffix is what the roadmap asked for, and it is enough right up
     * until the gesture is repeated: duplicating the same profile twice would
     * otherwise put two identically named rows in the tree, with nothing on
     * screen telling them apart.
     *
     * Duplicating a *copy* is a different case and keeps stacking —
     * "X - Copie - Copie" — because that name is genuinely free. Worth knowing
     * before reading it as a bug: it looked like one during the test of
     * 2026-08-03, until the gesture was retraced.
     *
     * Read off `rawGroupsSnapshot` rather than `config.store.profiles`: the
     * latter does not hold provider-contributed profiles, and this only has to
     * be right about what the folder *displays* (piège #74).
     */
    private copyNameFor (profile: PartialProfile<Profile>): string {
        const siblings = new Set(
            (this.rawGroupsSnapshot.find(g => g.id === (profile.group ?? 'ungrouped'))?.profiles ?? [])
                .map(p => p.name),
        )
        const base = this.i18n.t('{name} - Copy', { name: profile.name ?? '' })
        if (!siblings.has(base)) {
            return base
        }
        let n = 2
        while (siblings.has(`${base} ${n}`)) {
            n++
        }
        return `${base} ${n}`
    }

    ////// NOTES //////
    /**
     * The memo of a profile or folder, empty when there is none.
     *
     * Not inherited, unlike the snippet maps that sit beside it in the config:
     * a folder's note repeated on each of its profiles would be noise, so a
     * folder's note belongs to the folder and shows on its own row.
     */
    noteFor (id: string|undefined): string {
        return id ? (this.config.store.sidebarPlus?.profileNotes?.[id] ?? '') : ''
    }

    /**
     * Whether a badge is due on this row.
     *
     * Gated on the block rather than on the text alone: switching notes off has
     * to take the badges with it, and the note itself survives untouched for
     * when it comes back on.
     */
    hasNote (id: string|undefined): boolean {
        return this.showNotes && !!this.noteFor(id)
    }

    async openNoteModal (): Promise<void> {
        const id = this.contextMenuProfile?.id ?? this.contextMenuGroup?.id
        const name = this.contextMenuProfile?.name ?? this.contextMenuGroup?.name ?? ''
        this.closeContextMenu()
        if (!id) {
            return
        }
        const modal = this.ngbModal.open(NoteModalComponent, { size: 'lg' })
        modal.componentInstance.targetName = name
        modal.componentInstance.text = this.noteFor(id)
        const text = await modal.result.catch(() => null) as string|null
        if (text === null) {
            return
        }
        this.config.store.sidebarPlus ??= {}
        // Rebuilt and reassigned rather than mutated in place (piège #23), and
        // an emptied note leaves no key behind rather than an empty string
        // nobody can tell from "never written".
        const all: Record<string, string> = { ...(this.config.store.sidebarPlus.profileNotes ?? {}) }
        if (text.trim()) {
            all[id] = text
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete all[id]
        }
        this.config.store.sidebarPlus.profileNotes = all
        await this.config.save()
    }

    /** Puts the same note on a second id, leaving the first alone — used when a profile is duplicated. */
    private copyNote (fromId: string|undefined, toId: string|undefined): void {
        const text = this.noteFor(fromId)
        if (!text || !toId) {
            return
        }
        this.config.store.sidebarPlus ??= {}
        this.config.store.sidebarPlus.profileNotes = {
            ...(this.config.store.sidebarPlus.profileNotes ?? {}),
            [toId]: text,
        }
    }

    /** Carries a note over when a folder is given a new id, or drops it when an entry is deleted. */
    private moveNote (oldId: string, newId: string|null): void {
        this.config.store.sidebarPlus ??= {}
        const all: Record<string, string> = { ...(this.config.store.sidebarPlus.profileNotes ?? {}) }
        if (!(oldId in all)) {
            return
        }
        if (newId) {
            all[newId] = all[oldId]
        }
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete all[oldId]
        this.config.store.sidebarPlus.profileNotes = all
    }

    ////// GROUP SHARING (context menu) //////
    /**
     * "Copier la structure (JSON)" and "Copier sans les identifiants".
     *
     * Two entries rather than one setting: the level belongs to the gesture,
     * not to a preference — the same folder goes to one's other machine whole
     * and to a colleague stripped, and there is no reason to walk to the
     * settings between the two.
     *
     * Reads `rawGroupsSnapshot`, the workspace-*unfiltered* tree, for the same
     * reason `reparentGroup()` does: a folder half-hidden in the active
     * workspace would otherwise export as half a folder, silently.
     */
    async copyGroupStructure (level: PurgeLevel): Promise<void> {
        const group = this.contextMenuGroup
        this.closeContextMenu()
        if (!group) {
            return
        }
        const payload = buildPayload(group, this.rawGroupsSnapshot, level)
        this.platform.setClipboard({ text: JSON.stringify(payload, null, 2) })

        const { folders, profiles } = countPayload(payload.group)
        const purged = this.describePurgeText(payload.removed)
        this.notices.notice(
            this.i18n.t(
                'Folder "{name}" copied: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.',
                { name: group.name ?? '', folders, profiles },
            ),
            purged ? this.i18n.t('Removed: {purged}.', { purged }) : undefined,
        )
    }

    /**
     * "Coller le groupe", from the right-click on empty sidebar space.
     *
     * At the root only, which is where the roadmap put it. Pasting *into* a
     * folder is the same code with a different parent, but the folder menu
     * already carries eleven entries and nobody has asked.
     *
     * Nothing here trusts the payload: `parsePayload()` re-runs the purge on
     * the way in, because the JSON is text off the clipboard — hand-editable,
     * possibly written elsewhere — and its own account of what it had removed
     * is worth nothing.
     */
    async pasteGroup (): Promise<void> {
        this.closeContextMenu()
        const { payload, error } = parsePayload(this.platform.readClipboard())
        if (!payload) {
            this.notices.error(error ? this.tMsg(error) : this.i18n.t('The clipboard does not hold a shared folder.'))
            return
        }

        const name = payload.group.name?.trim() || this.i18n.t('Pasted folder')
        const { folders, profiles } = countPayload(payload.group)
        const purged = this.describePurgeText(payload.removed)

        // Against the root folders as *displayed*, from the unfiltered
        // snapshot: a folder hidden in the active workspace still occupies its
        // name, and colliding with something invisible is worse than colliding
        // with something one can see (piège #74).
        const collision = this.rawGroupsSnapshot.find(g => !g.parentGroupId && g.name === name)
        let target: string|null = null
        let finalName = name

        if (collision) {
            const modal = this.ngbModal.open(PasteGroupModalComponent)
            modal.componentInstance.groupName = name
            modal.componentInstance.folders = folders
            modal.componentInstance.profiles = profiles
            modal.componentInstance.suffixedName = this.rootGroupCopyName(name)
            modal.componentInstance.purged = purged
            const resolution = await modal.result.catch(() => null) as PasteResolution|null
            if (!resolution) {
                return
            }
            if (resolution === 'merge') {
                target = collision.id
            } else {
                finalName = this.rootGroupCopyName(name)
            }
        }

        const created = await this.applySharedGroup(payload.group, finalName, target, undefined)
        await this.config.save()

        // A profile whose provider is not installed is not an error — it is
        // stored fine and does nothing when launched. Said once, here, because
        // the row looks exactly like any other and the failure would only show
        // on a double-click much later.
        const unknown = created.types.filter(t => !this.profileProviders.some(p => p.id === t))
        this.notices.notice(
            this.i18n.t(
                'Folder "{name}" pasted: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.',
                { name: finalName, folders: created.folders, profiles: created.profiles },
            ),
            [
                purged ? this.i18n.t('Removed at export: {purged}. To be re-entered.', { purged }) : '',
                unknown.length ? this.i18n.t(
                    '{count, plural, one {Profile type not installed} other {Profile types not installed}}: {list}.',
                    { count: unknown.length, list: [...new Set(unknown)].join(', ') },
                ) : '',
            ].filter(Boolean).join(' ') || undefined,
        )

        // Said separately, and as an error: a payload that still carried what
        // its own header called removed was not written by this plugin, or was
        // edited afterwards. The paste itself is fine — the second purge caught
        // it — but the user is entitled to know the JSON they pasted was not
        // what it claimed.
        if (!isEmptyReport(payload.strippedOnImport)) {
            this.notices.error(
                this.i18n.t('This JSON still carried secrets its own header declared removed.'),
                this.i18n.t('Removed at paste: {purged}.', { purged: this.describePurgeText(payload.strippedOnImport!) }),
            )
        }
    }

    /**
     * Writes one shared folder and everything under it into the config.
     *
     * `target` is set only when merging: the folder already exists, so nothing
     * is created for this level and the contents land inside it. A sub-folder
     * colliding *inside* a merge is not asked about again — it is created
     * alongside, which the modal says out loud.
     *
     * `newProfileGroup({ genId: true })` mints the id and writes it back onto
     * the object handed over, exactly as `reparentGroup()` relies on.
     */
    private async applySharedGroup (
        shared: SharedGroup,
        name: string,
        target: string|null,
        parentGroupId: string|undefined,
    ): Promise<{ folders: number, profiles: number, types: string[] }> {
        let groupId = target
        let folders = 0
        if (!groupId) {
            const group = {
                id: '',
                name,
                icon: shared.icon,
                color: shared.color,
                defaults: shared.defaults,
                parentGroupId,
            } as PartialProfileGroup<ProfileGroup>
            await this.profilesService.newProfileGroup(group, { genId: true })
            groupId = group.id
            folders = 1
        }

        let profiles = 0
        const types: string[] = []
        for (const shape of shared.profiles) {
            // Rebuilt rather than spread from the payload: what goes into
            // `config.store.profiles` is the plugin's own object, never one
            // parsed off the clipboard. `newProfile()` mints the id.
            const profile = {
                name: shape.name || 'Profil',
                type: shape.type,
                icon: shape.icon,
                color: shape.color,
                weight: shape.weight,
                options: shape.options ?? {},
                group: groupId,
            } as PartialProfile<Profile>
            await this.profilesService.newProfile(profile)
            profiles++
            if (shape.type) {
                types.push(shape.type)
            }
        }

        for (const child of shared.children) {
            const sub = await this.applySharedGroup(child, child.name?.trim() || this.i18n.t('Folder'), null, groupId)
            folders += sub.folders
            profiles += sub.profiles
            types.push(...sub.types)
        }

        return { folders, profiles, types }
    }

    /**
     * "Prod" → "Prod - Copie", then "Prod - Copie 2", among the root folders.
     *
     * Same shape as `copyNameFor()` for profiles, deliberately: two gestures
     * that produce a near-duplicate should name it the same way, and the user
     * has already read that suffix once.
     */
    private rootGroupCopyName (name: string): string {
        const taken = new Set(this.rawGroupsSnapshot.filter(g => !g.parentGroupId).map(g => g.name))
        const base = this.i18n.t('{name} - Copy', { name })
        if (!taken.has(base)) {
            return base
        }
        let n = 2
        while (taken.has(`${base} ${n}`)) {
            n++
        }
        return `${base} ${n}`
    }

    ////// SNIPPETS //////
    /** How long a snippet waits for a session it asked to be launched, and how often it looks. */
    private static readonly SNIPPET_LAUNCH_POLL_MS = 250
    private static readonly SNIPPET_LAUNCH_ATTEMPTS = 80

    /**
     * Opens the snippets modal on the right-clicked profile or folder.
     *
     * Everything it shows and writes lives in `SidebarPlusSnippetsService`.
     * What stays here is what needs the sidebar's own reach: running a snippet
     * into a session, and opening the settings tab.
     */
    async openSnippetsModal (): Promise<void> {
        const profile = this.contextMenuProfile
        const group = this.contextMenuGroup
        this.closeContextMenu()
        const modal = this.ngbModal.open(SnippetsModalComponent, { size: 'lg' })
        modal.componentInstance.profile = profile
        modal.componentInstance.group = group
        const result = await modal.result.catch(() => null) as SnippetsModalResult|null
        if (!result) {
            return
        }
        if (result.action === 'library') {
            SidebarPlusSettingsTabComponent.requestedSection = 'snippets'
            this.openPluginSettings()
            return
        }
        await this.runSnippet(result.snippet, profile)
    }

    /**
     * Opens one of the footer's outbound links in the user's browser.
     *
     * `platform.openExternal()`, never a plain `href`: an anchor left to
     * navigate would replace the whole Electron window with the target page,
     * taking every open session down with it. Same call the tunnel rows make.
     */
    openExternalLink (url: string, event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        this.platform.openExternal(url)
    }

    /**
     * Opens the plugin's settings tab, resolving whichever tab id currently
     * hosts it — 'better-tabby' when the "Better *" family is unified,
     * 'better-sidebar' when this plugin is alone. Never hardcode the id (see
     * `electBetterPanelHost()`); callers that want a specific section set
     * `SidebarPlusSettingsTabComponent.requestedSection` first.
     */
    openPluginSettings (): void {
        const election = electBetterPanelHost(this.injector)
        if (election.unified) {
            // Whichever plugin hosts the panel reads this at construction
            // and pre-selects our tab, so a section request above lands
            // even when the vault carries the settings.
            this.injector.get<BetterPanelContribution>(SIDEBAR_PANEL_TOKEN as any).openRequested = true
        }
        this.openSettingsTab(election.settingsTabId)
    }

    /**
     * Writes a snippet into the profile's session.
     *
     * Both behaviours are resolved from the chain, so the answer may come from
     * the profile, from its folder, or from one further up.
     */
    private async runSnippet (snippet: SidebarSnippet, profile: PartialProfile<Profile>|null): Promise<void> {
        if (!profile) {
            return
        }
        const chain = this.snippets.chainForProfile(profile)
        // The snippet is passed along: its own answer overrides the profile and
        // its folders, so a destructive command cannot be made self-running by
        // a permissive folder.
        const execute = this.snippets.resolveSetting('execute', chain, snippet.id)
        const autoLaunch = this.snippets.resolveSetting('autoLaunch', chain, snippet.id)
        const { text, missing } = this.snippets.expand(snippet, chain, profile)
        if (missing.length) {
            this.notices.error(
                this.i18n.t('"{name}" expects a value', { name: snippet.name }),
                this.i18n.t('{list}: to fill in under "Snippets".', { list: missing.map(name => `{{${name}}}`).join(', ') }),
            )
            return
        }

        let tab = this.terminalTabForProfile(profile)
        if (!tab) {
            if (!autoLaunch) {
                this.notices.notice(this.i18n.t('"{name}" has no open session', { name: profile.name }))
                return
            }
            await this.launchProfile(profile)
            tab = await this.waitForTerminalTab(profile)
            if (!tab) {
                this.notices.error(this.i18n.t('The session of "{name}" did not open', { name: profile.name }))
                return
            }
            // Only on a session this click just opened: an already-open one has
            // nothing left to settle. See `launchDelayMs` for why a plain wait
            // is the honest answer here rather than a cleverer one.
            const delay = this.snippets.resolveDelay(chain, snippet.id)
            if (delay) {
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
        // Brought to the front before anything is written: in the default
        // "type it, don't run it" mode the command sits at the prompt waiting
        // for the user's Entrée, and a prompt they cannot see is worse than no
        // snippet at all.
        focusTab(this.app, tab)
        tab.sendInput(execute ? `${text}\n` : text)
    }

    /**
     * Any terminal tab currently backed by this profile — SSH or not.
     *
     * Deliberately wider than `connectedTabForProfile()`, which answers the
     * same question for tunnels and has to stay SSH-only. What a snippet needs
     * is something that can be typed into, i.e. a `BaseTerminalTabComponent`,
     * so a local profile gets snippets too.
     *
     * `instanceof` is safe on this class where it is not on `SSHTabComponent`:
     * Tabby's plugin loader caches `tabby-terminal`, so only one copy of it is
     * ever loaded (piège #34 is about `tabby-ssh`, which it does not cache).
     * `hotkeys.ts` already leans on the same test.
     */
    private terminalTabForProfile (profile: PartialProfile<Profile>): BaseTerminalTabComponent<any>|null {
        if (!profile.id) {
            return null
        }
        for (const tab of getAllOpenTabs(this.app)) {
            if (!(tab instanceof BaseTerminalTabComponent)) {
                continue
            }
            const backing = tab as unknown as ProfileBackedTab
            // A non-null `session` is the honest "still live" test — see
            // isLiveSSHTab() for why the transport's own flag is not.
            if (backing.profile?.id === profile.id && backing.session) {
                return tab
            }
        }
        return null
    }

    /**
     * Polls for the session a launch is bringing up.
     *
     * There is no "the remote shell is ready" signal to await: `launchProfile()`
     * resolves once the tab exists, and the transport comes up some time later.
     * So the tab is polled for, and what the snippet then hits is whatever the
     * prompt is at that moment — on a server with a long MOTD the text can land
     * mid-banner. Survivable because the default is to *type* the command
     * rather than run it. The optional wait is for the servers where it is not
     * enough.
     */
    private async waitForTerminalTab (profile: PartialProfile<Profile>): Promise<BaseTerminalTabComponent<any>|null> {
        for (let attempt = 0; attempt < SidebarPlusTreeComponent.SNIPPET_LAUNCH_ATTEMPTS; attempt++) {
            await new Promise(resolve => setTimeout(resolve, SidebarPlusTreeComponent.SNIPPET_LAUNCH_POLL_MS))
            const tab = this.terminalTabForProfile(profile)
            if (tab) {
                return tab
            }
        }
        return null
    }

    /** Settings > Profiles. Only reached when a profile has no resolvable provider. */
    private openProfilesSettingsTab (): void {
        this.openSettingsTab('profiles')
    }

    /** Reuses a Settings tab the user already had open rather than stacking a second one. */
    private openSettingsTab (activeTab: string): void {
        const existing = this.app.tabs.find(t => t instanceof SettingsTabComponent) as SettingsTabComponent|undefined
        if (existing) {
            existing.activeTab = activeTab
            this.app.selectTab(existing)
            return
        }
        this.app.openNewTabRaw({ type: SettingsTabComponent, inputs: { activeTab } })
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
                reasons.push(this.i18n.t('{count, plural, one {# subfolder} other {# subfolders}}', { count: childCount }))
            }
            if (profileCount) {
                reasons.push(this.i18n.t('{count, plural, one {# profile} other {# profiles}}', { count: profileCount }))
            }
            // Said explicitly when the folder looks empty on screen: otherwise
            // the refusal reads as a bug rather than as a warning.
            const visible = (group.children?.length ?? 0) + (group.profiles?.length ?? 0)
            const hint = visible === 0
                ? ' ' + this.i18n.t('This content is hidden in the workspace "{name}".', { name: this.activeWorkspace?.name ?? this.i18n.t('current') })
                : ''
            this.notifications.error(
                this.i18n.t('Cannot delete "{name}"', { name: group.name }),
                this.i18n.t('This folder still contains {reasons}.{hint} Empty it first.', {
                    reasons: reasons.length === 2 ? this.i18n.t('{a} and {b}', { a: reasons[0], b: reasons[1] }) : reasons[0],
                    hint,
                }),
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
