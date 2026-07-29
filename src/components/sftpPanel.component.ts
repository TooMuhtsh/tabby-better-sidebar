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
import { SFTPPanelComponent, SSHTabComponent } from 'tabby-ssh'

/**
 * Hosts Tabby's own `SFTPPanelComponent` inside the sidebar, bound to whatever
 * SSH tab currently has focus.
 *
 * The panel is created imperatively rather than written as `<sftp-panel>` in
 * this component's template: `SSHModule` *declares* SFTPPanelComponent but
 * does not list it in `exports`, so its selector is not visible to any other
 * module's templates (verified in the compiled NgModule metadata of the
 * installed tabby-ssh). `createComponent()` bypasses template scope entirely —
 * the same trick already used by SidebarPlusMountService to graft this
 * plugin's own tree into Tabby's shell.
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
     * rebuilt. Two reasons, both load-bearing: `SFTPPanelComponent.ngOnInit()`
     * calls `session.openSFTP()`, which opens a *new* SFTP channel every time
     * (and `SFTPSession` exposes no `close()` — the channel only dies with the
     * SSH session), so rebuilding on every switch would leak one channel per
     * switch; and the panel's own `path` is what gives us the roadmap's
     * per-tab navigation memory for free, with nothing persisted.
     */
    private panels = new Map<SSHTabComponent, ComponentRef<SFTPPanelComponent>>()
    private boundTab: SSHTabComponent|null = null
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
        // No sync() call here on purpose: the first one is left to timer(0),
        // which lands on the next tick, outside the change detection pass that
        // is running right now — attachView() during CD is asking for trouble.
        this.subscription = merge(
            this.app.activeTabChange$,
            this.app.tabsChanged$,
            this.app.tabClosed$,
            // The focused tab can stay the same while its session comes up
            // (or drops): nothing emits for that, so the bound tab is also
            // re-evaluated on a slow tick.
            timer(0, 1000),
        ).subscribe(() => {
            // Pruning runs even while the view is inactive, so panels of tabs
            // closed in the meantime don't sit in the cache until the user
            // next opens the SFTP view.
            this.pruneClosedTabs()
            this.sync()
        })
    }

    ngOnDestroy (): void {
        this.subscription?.unsubscribe()
        this.splitFocusSubscription?.unsubscribe()
        for (const ref of this.panels.values()) {
            this.destroyPanel(ref)
        }
        this.panels.clear()
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
        this.boundTabTitle = null
    }

    private sync (): void {
        if (!this.isActive || !this.viewInitialized) {
            return
        }
        this.watchSplitFocus()

        const tab = this.resolveFocusedSSHTab()
        if (tab === this.boundTab) {
            return
        }
        if (this.boundTab) {
            this.detachPanel(this.boundTab)
        }
        this.boundTab = tab
        this.boundTabTitle = tab?.title ?? null
        if (tab) {
            this.attachPanel(tab)
        }
    }

    /**
     * The active tab is not enough: inside a split, every pane is a tab of its
     * own and only `getFocusedTab()` says which one the user is actually
     * looking at.
     */
    private resolveFocusedSSHTab (): SSHTabComponent|null {
        let tab: BaseTabComponent|null = this.app.activeTab
        if (tab instanceof SplitTabComponent) {
            tab = tab.getFocusedTab()
        }
        if (!(tab instanceof SSHTabComponent)) {
            return null
        }
        // A tab whose session is still negotiating (or already dropped) has no
        // usable transport — SFTPPanelComponent would call openSFTP() on it
        // and throw. Stay on the placeholder until it is genuinely up.
        return tab.sshSession?.open ? tab : null
    }

    /** Follows focus moves between panes of the active split tab, which emit nothing on AppService. */
    private watchSplitFocus (): void {
        const active = this.app.activeTab
        if (!(active instanceof SplitTabComponent)) {
            this.splitFocusSubscription?.unsubscribe()
            this.splitFocusSubscription = null
            return
        }
        if (this.splitFocusSubscription) {
            return
        }
        this.splitFocusSubscription = active.focusChanged$.subscribe(() => this.sync())
    }

    /** Drops cached panels whose tab is gone, so a long session doesn't accumulate dead views. */
    private pruneClosedTabs (): void {
        const open = new Set(this.getAllOpenTabs())
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

    private getAllOpenTabs (): BaseTabComponent[] {
        return this.app.tabs.flatMap(tab => tab instanceof SplitTabComponent ? tab.getAllTabs() : [tab])
    }

    private attachPanel (tab: SSHTabComponent): void {
        let ref = this.panels.get(tab)
        if (!ref) {
            ref = createComponent(SFTPPanelComponent, {
                environmentInjector: this.environmentInjector,
            })
            // Both inputs must be set before the view is attached: attachView()
            // is what triggers the first change detection pass, and that is
            // where ngOnInit() reads `session` to open the SFTP channel.
            ref.instance.session = tab.sshSession!
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

    private destroyPanel (ref: ComponentRef<SFTPPanelComponent>): void {
        this.rootNodeOf(ref).remove()
        this.appRef.detachView(ref.hostView)
        ref.destroy()
    }

    private rootNodeOf (ref: ComponentRef<SFTPPanelComponent>): HTMLElement {
        return (ref.hostView as unknown as { rootNodes: HTMLElement[] }).rootNodes[0]
    }
}
