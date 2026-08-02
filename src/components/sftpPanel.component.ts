import './sftpPanel.component.scss'
import { merge, Subscription, timer } from 'rxjs'
import {
    ApplicationRef,
    Component,
    ComponentRef,
    ElementRef,
    EnvironmentInjector,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
    ViewChild,
    createComponent,
} from '@angular/core'
import { AppService, BaseTabComponent, SplitTabComponent } from 'tabby-core'
import { SSHTabComponent } from 'tabby-ssh'
import { getAllOpenTabs, isLiveSSHTab } from '../tabs'
import { SidebarPlusSftpBrowserComponent } from './sftpBrowser.component'

/**
 * Hosts the SFTP browser inside the sidebar, bound to whatever SSH tab
 * currently has focus.
 *
 * The browser is `SidebarPlusSftpBrowserComponent` — tabby-ssh's own
 * `SFTPPanelComponent` subclassed with our template, see that file. It is
 * created imperatively rather than written into this template because the
 * caching below needs to own its lifecycle: a view built by `*ngFor`/`*ngIf`
 * is destroyed the moment its condition flips, which is exactly what must not
 * happen here.
 */
@Component({
    selector: 'sidebar-plus-sftp',
    template: require('./sftpPanel.component.pug'),
})
export class SidebarPlusSftpComponent implements OnInit, OnDestroy {
    /** Emitted when the hosted panel's own close button is pressed — the sidebar switches back to the profile tree. */
    @Output() closed = new EventEmitter<void>()

    /**
     * Whether the sidebar is currently showing this view.
     *
     * This component stays mounted while the sidebar is on the profile tree
     * (an `*ngIf` would destroy it, and with it the panel cache — every
     * Profils↔SFTP round trip would then open a fresh SFTP channel that
     * nothing ever closes). But staying mounted must not mean staying busy:
     * without this flag it would happily open a channel on every SSH tab the
     * user focuses, for a view they are not looking at.
     */
    @Input() set active (value: boolean) {
        if (this.isActive === value) {
            return
        }
        this.isActive = value
        if (value) {
            this.sync()
        } else {
            this.releaseBoundPanel()
        }
    }

    private isActive = false

    /** Name of the SSH tab the panel is currently bound to, for the header line. */
    boundTabTitle: string|null = null
    /** True while no focused tab offers a connected SSH session — drives the "waiting" placeholder. */
    get waiting (): boolean {
        return this.boundTab === null
    }

    @ViewChild('panelContainer', { static: true }) panelContainer!: ElementRef<HTMLElement>

    /**
     * One panel per SSH tab, kept alive across tab switches instead of being
     * rebuilt. Two reasons, both load-bearing: the inherited
     * `SFTPPanelComponent.ngOnInit()` calls `session.openSFTP()`, which opens
     * a *new* SFTP channel every time
     * (and `SFTPSession` exposes no `close()` — the channel only dies with the
     * SSH session), so rebuilding on every switch would leak one channel per
     * switch; and the panel's own `path` is what gives us the roadmap's
     * per-tab navigation memory for free, with nothing persisted.
     */
    private panels = new Map<SSHTabComponent, ComponentRef<SidebarPlusSftpBrowserComponent>>()
    private boundTab: SSHTabComponent|null = null
    /**
     * The session the visible panel was built against.
     *
     * Tracked separately from the tab because a tab that loses its connection
     * and reconnects is *the same object* — only `sshSession` is replaced. The
     * tab alone was what sync() compared, so it returned early forever and the
     * rebuild in attachPanel() was never reached: the panel stayed bound to the
     * dead transport, answering "Session closed" to every gesture, until the
     * tab itself was killed.
     */
    private boundSession: SSHTabComponent['sshSession'] = null
    /**
     * Last remote directory each tab was browsing, so a rebuilt panel resumes
     * where the old one was.
     *
     * The cache gave that memory for free — a panel that is never destroyed
     * keeps its own `path`. Rebuilding on a reconnect is the one path that
     * loses it, and landing back on `/` after every dropped link is exactly
     * the kind of small regression that makes a feature feel unfinished.
     * Re-injected before the new panel's ngOnInit reads it; if the directory
     * is gone by then, the inherited ngOnInit already notifies and falls back
     * to `/` on its own.
     */
    private lastPaths = new Map<SSHTabComponent, string>()
    private subscription: Subscription|null = null
    /** Tracks the focus changes *within* the active split tab, re-subscribed whenever the active tab changes. */
    private splitFocusSubscription: Subscription|null = null
    /**
     * Angular assigns `@Input()`s before it resolves even a `static: true`
     * @ViewChild, so a sidebar that starts up already in SFTP mode would run
     * the `active` setter — and therefore attachPanel() — while
     * `panelContainer` is still undefined. Nothing may touch the DOM before
     * ngOnInit has been reached.
     */
    private viewInitialized = false

    constructor (
        private app: AppService,
        private appRef: ApplicationRef,
        private environmentInjector: EnvironmentInjector,
    ) { }

    ngOnInit (): void {
        this.viewInitialized = true
        this.subscription = new Subscription()

        // Pruning is driven by the two events that actually retire a tab —
        // tabRemoved$ included, which is what fires when a pane leaves a split
        // — and never by the tick below. It walks every tab of every split, so
        // running it once a second forever would cost far more than it saves,
        // for a view the user is usually not even looking at.
        this.subscription.add(
            merge(this.app.tabClosed$, this.app.tabRemoved$).subscribe(() => {
                this.pruneClosedTabs()
                this.sync()
            }),
        )

        // No sync() call here on purpose: the first one is left to timer(0),
        // which lands on the next tick, outside the change detection pass that
        // is running right now — attachView() during CD is asking for trouble.
        this.subscription.add(
            merge(
                this.app.activeTabChange$,
                this.app.tabsChanged$,
                // The focused tab can stay the same while its session comes up
                // (or drops): nothing emits for that, so the bound tab is also
                // re-evaluated on a slow tick. sync() returns immediately while
                // the view is inactive, so this idles at near-zero cost.
                timer(0, 1000),
            ).subscribe(() => this.sync()),
        )
    }

    ngOnDestroy (): void {
        this.subscription?.unsubscribe()
        this.splitFocusSubscription?.unsubscribe()
        for (const ref of this.panels.values()) {
            this.destroyPanel(ref)
        }
        this.panels.clear()
        this.lastPaths.clear()
    }

    /**
     * Puts the visible panel back in the cache: out of the DOM and out of
     * change detection, but not destroyed, so re-entering the view rebinds it
     * without opening a second SFTP channel. `boundTab` has to be cleared too,
     * otherwise the next sync() would see no change and never re-attach.
     */
    private releaseBoundPanel (): void {
        if (this.boundTab) {
            this.detachPanel(this.boundTab)
        }
        this.boundTab = null
        this.boundSession = null
        this.boundTabTitle = null
    }

    private sync (): void {
        if (!this.isActive || !this.viewInitialized) {
            return
        }
        this.watchSplitFocus()

        // Hand the sidebar back to the profile tree rather than leave a panel
        // that can no longer serve anything on screen. Decided with the user on
        // 2026-08-02, and it covers `exit` as much as a dropped link: the
        // transport survives a shell that ended, so the SFTP view went on
        // working for a session "Sessions actives" had already dropped — two
        // blocks of the same sidebar answering "does this session exist"
        // differently. No automatic return when it comes back: one click is
        // enough, and the user may well have moved on to the profiles.
        if (this.boundSessionIsLost()) {
            this.dropDeadPanel()
            this.closed.emit()
            return
        }

        const tab = this.resolveFocusedSSHTab()
        if (tab === this.boundTab && tab?.sshSession === this.boundSession) {
            return
        }
        if (this.boundTab) {
            this.detachPanel(this.boundTab)
        }
        this.boundTab = tab
        this.boundSession = tab?.sshSession ?? null
        this.boundTabTitle = tab?.title ?? null
        if (tab) {
            this.attachPanel(tab)
        }
    }

    /**
     * True when the panel on screen is bound to a session that is gone for
     * good — as opposed to one that has already been replaced by a reconnect,
     * which is a rebuild and is handled by attachPanel().
     */
    private boundSessionIsLost (): boolean {
        const tab = this.boundTab
        if (!tab) {
            return false
        }
        if (tab.sshSession !== this.boundSession) {
            return false
        }
        // `sftpUnavailable`: the channel never opened at all (piège #57). The
        // panel is up but empty and mute, so there is nothing to keep showing.
        return !isLiveSSHTab(tab) || (this.panels.get(tab)?.instance.sftpUnavailable ?? false)
    }

    /**
     * Unlike releaseBoundPanel(), this destroys the panel instead of caching
     * it: it holds an SFTP channel on a transport that is gone, so nothing in
     * it can be reused, and keeping it would only hand it back on the next
     * visit to a tab that is about to get a brand new session anyway.
     */
    private dropDeadPanel (): void {
        const tab = this.boundTab
        if (tab) {
            const ref = this.panels.get(tab)
            if (ref) {
                this.rememberPath(tab, ref)
                this.destroyPanel(ref)
                this.panels.delete(tab)
            }
        }
        this.boundTab = null
        this.boundSession = null
        this.boundTabTitle = null
    }

    /**
     * The active tab is not enough: Tabby wraps every tab in a
     * `SplitTabComponent`, so `app.activeTab` is always the split and only
     * `getFocusedTab()` names the pane the user is actually looking at.
     */
    private resolveFocusedSSHTab (): SSHTabComponent|null {
        let tab: BaseTabComponent|null = this.app.activeTab
        if (tab instanceof SplitTabComponent) {
            tab = tab.getFocusedTab()
        }
        // This `instanceof` only holds because `tabby-ssh` is absent from
        // node_modules — see src/types/tabby-ssh/PROVENANCE.md. Reinstall it
        // and this silently returns null forever, against a class that merely
        // shares its name.
        if (!(tab instanceof SSHTabComponent)) {
            return null
        }
        // A tab whose session is still negotiating (or already dropped) has no
        // usable transport — the browser's ngOnInit would call openSFTP() on
        // it and throw. Stay on the placeholder until it is genuinely up.
        //
        // `sshSession.open` alone was the test here, and it is a lie for a
        // session that died: the flag is never cleared (see isLiveSSHTab).
        return isLiveSSHTab(tab) ? tab : null
    }

    /**
     * Follows focus moves between panes of the active split tab, which emit
     * nothing on AppService.
     *
     * Unsubscribes unconditionally before resubscribing: an earlier version
     * kept the existing subscription whenever there was one, which meant that
     * after moving from split A to split B the panel went on listening to A
     * forever. Only visible in a specific sequence — selecting a split does not
     * itself settle which pane is focused, so a *later* focus change inside B
     * was the only correction available, and it never arrived. The sidebar's
     * "open this session's SFTP" shortcut walks exactly that path (selectTab
     * then focus), so it would have bound the panel to whichever pane B last
     * had focused instead of the one asked for.
     */
    private watchSplitFocus (): void {
        this.splitFocusSubscription?.unsubscribe()
        this.splitFocusSubscription = null
        const active = this.app.activeTab
        if (active instanceof SplitTabComponent) {
            this.splitFocusSubscription = active.focusChanged$.subscribe(() => this.sync())
        }
    }

    /** Drops cached panels whose tab is gone, so a long session doesn't accumulate dead views. */
    private pruneClosedTabs (): void {
        const open = new Set(getAllOpenTabs(this.app))
        for (const tab of this.lastPaths.keys()) {
            if (!open.has(tab)) {
                this.lastPaths.delete(tab)
            }
        }
        for (const [tab, ref] of this.panels) {
            if (!open.has(tab)) {
                this.destroyPanel(ref)
                this.panels.delete(tab)
                if (this.boundTab === tab) {
                    this.boundTab = null
                    this.boundTabTitle = null
                }
            }
        }
    }

    private attachPanel (tab: SSHTabComponent): void {
        let ref = this.panels.get(tab)
        // A cached panel binds its session **once**, at creation, and this cache
        // is only ever pruned when the tab itself goes away. So a connection
        // that drops and comes back handed the user the old panel, still
        // holding the dead transport and its closed SFTP channel: nothing
        // displayed, nothing recoverable, and killing the tab was the only
        // gesture that emptied the cache. Rebuilding on identity change is what
        // makes a reconnected session usable again.
        if (ref && (ref.instance.session !== tab.sshSession || ref.instance.sftpUnavailable)) {
            this.rememberPath(tab, ref)
            this.destroyPanel(ref)
            this.panels.delete(tab)
            ref = undefined
        }
        if (!ref) {
            ref = createComponent(SidebarPlusSftpBrowserComponent, {
                environmentInjector: this.environmentInjector,
            })
            // Both inputs must be set before the view is attached: attachView()
            // is what triggers the first change detection pass, and that is
            // where ngOnInit() reads `session` to open the SFTP channel.
            ref.instance.session = tab.sshSession!
            // Same window for `path`, and for the same reason — ngOnInit
            // navigates to it. Only set when there is something to restore, so
            // a first panel keeps the inherited default.
            const path = this.lastPaths.get(tab)
            if (path) {
                ref.instance.path = path
            }
            // Suppresses the panel's "working directory detection" tip banner,
            // which needs a shell session we deliberately don't reach for here.
            ref.instance.cwdDetectionAvailable = false
            ref.instance.closed.subscribe(() => this.closed.emit())
            this.panels.set(tab, ref)
        }
        this.appRef.attachView(ref.hostView)
        this.panelContainer.nativeElement.appendChild(this.rootNodeOf(ref))
    }

    /**
     * Takes the panel out of the DOM *and* out of change detection, but keeps
     * the ComponentRef — see the `panels` field for why it is not destroyed.
     */
    private detachPanel (tab: SSHTabComponent): void {
        const ref = this.panels.get(tab)
        if (!ref) {
            return
        }
        this.rootNodeOf(ref).remove()
        this.appRef.detachView(ref.hostView)
    }

    private rememberPath (tab: SSHTabComponent, ref: ComponentRef<SidebarPlusSftpBrowserComponent>): void {
        if (ref.instance.path) {
            this.lastPaths.set(tab, ref.instance.path)
        }
    }

    private destroyPanel (ref: ComponentRef<SidebarPlusSftpBrowserComponent>): void {
        this.rootNodeOf(ref).remove()
        this.appRef.detachView(ref.hostView)
        ref.destroy()
    }

    private rootNodeOf (ref: ComponentRef<SidebarPlusSftpBrowserComponent>): HTMLElement {
        return (ref.hostView as unknown as { rootNodes: HTMLElement[] }).rootNodes[0]
    }
}
