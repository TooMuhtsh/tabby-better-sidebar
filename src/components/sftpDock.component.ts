import './sftpDock.component.scss'
import { Component, ElementRef, HostBinding, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { Subscription } from 'rxjs'
import { ConfigService, HostAppService, HostWindowService, Platform } from 'tabby-core'
import { SidebarPlusSftpViewService } from '../sftpView.service'
import { SidebarPlusSftpComponent } from './sftpPanel.component'

/** Narrow enough for a name column, wide enough for size and date beside it. */
const MIN_WIDTH = 320
/** Past this a file table stops gaining and starts eating the terminal. */
const MAX_WIDTH = 960
const DEFAULT_WIDTH = 460
/** Never let the dock take more than this share of the window, whatever the drag says. */
const MAX_WINDOW_SHARE = 0.7
/** Delay before a width is written to localStorage, so a drag writes once and not on every pointer move. */
const SAVE_DELAY_MS = 250

/** Per machine, like `sidebarPlusTreeWidth`. The room on a laptop screen says nothing about another machine. */
const WIDTH_KEY = 'sidebarPlusSftpDockWidth'

/**
 * The SFTP view as a full-height column on the right of the window, beside a
 * sidebar that keeps the profile tree. Only exists with
 * `sidebarPlus.sftpPlacement` set to `right`.
 *
 * Mounted by SidebarPlusMountService as the last child of Tabby's own
 * `.window` flex row, the mirror image of the sidebar, which is its first
 * child. The terminal in the middle refits on its own, because Tabby's
 * frontends observe their own host with a ResizeObserver.
 *
 * Closed means hidden, not destroyed. The SFTP host inside goes inactive and
 * parks its panel, exactly like the sidebar's host does while the profiles
 * are showing.
 *
 * Adapted from the fork of miller806 (commits 01eee35, 36af502, 3f2096d,
 * cc41e5c).
 */
@Component({
    selector: 'sidebar-plus-sftp-dock',
    template: require('./sftpDock.component.pug'),
})
export class SidebarPlusSftpDockComponent implements OnInit, OnDestroy {
    @ViewChild(SidebarPlusSftpComponent) private panel?: SidebarPlusSftpComponent

    private width = Math.min(SidebarPlusSftpDockComponent.readWidth(), SidebarPlusSftpDockComponent.windowCap())
    private startX = 0
    private startWidth = 0
    private saveTimer: ReturnType<typeof setTimeout>|null = null
    private subscription = new Subscription()
    /** Removes the document listeners of a resize in progress, or null when none is. */
    private stopDragging: (() => void)|null = null
    private readonly onWindowResize = (): void => {
        const capped = Math.min(this.width, SidebarPlusSftpDockComponent.windowCap())
        if (capped !== this.width) {
            this.applyWidth(capped)
        }
    }

    constructor (
        private view: SidebarPlusSftpViewService,
        private config: ConfigService,
        private hostApp: HostAppService,
        private hostWindow: HostWindowService,
        private element: ElementRef<HTMLElement>,
        private zone: NgZone,
    ) { }

    get open (): boolean {
        return this.view.dockOpen
    }

    /** Same rule as the sidebar's own `showTransfers`. The dock only exists with the SFTP view on. */
    get showTransfers (): boolean {
        return this.config.store.sidebarPlus?.showTransfers ?? true
    }

    /**
     * Closed, the dock is off the screen and out of the flex row, so the
     * terminal gets the width back at once. The attribute alone would lose to
     * the tag's own `display: flex`, hence the matching `[hidden]` rule in the
     * stylesheet.
     */
    @HostBinding('attr.hidden')
    get hiddenAttr (): ''|null {
        return this.open ? null : ''
    }

    /**
     * Room for the Windows window buttons. With the "thin" frame and the tabs
     * on top, Windows draws minimise, maximise and close over the top right
     * corner of the window, and Tabby keeps a spacer at the end of its tab bar
     * for them (`.window-controls-spacer`, appRoot.component.pug on 1.0.238).
     * That corner is the dock's once it is open, so the dock takes a strip as
     * tall as the tab bar, and hostChrome.scss drops the spacer that has
     * nothing left to protect. The mirror image of the macOS inset of the
     * sidebar (#13), on the other side and with the same condition as Tabby's.
     */
    @HostBinding('class.sidebar-plus-win-inset')
    get winInset (): boolean {
        return this.hostApp.platform === Platform.Windows
            && !this.hostWindow.isFullscreen
            && this.config.store.appearance?.frame === 'thin'
            && this.config.store.appearance?.tabsLocation === 'top'
    }

    ngOnInit (): void {
        this.applyWidth(this.width)
        this.subscription.add(this.view.unfreezeRequested.subscribe(() => this.panel?.unfreeze()))
        // Outside the zone, because a resize event needs no change detection.
        // The width is written straight to the element.
        this.zone.runOutsideAngular(() => window.addEventListener('resize', this.onWindowResize))
    }

    ngOnDestroy (): void {
        this.subscription.unsubscribe()
        window.removeEventListener('resize', this.onWindowResize)
        this.stopDragging?.()
        this.flushSave()
    }

    hide (): void {
        this.view.hide()
    }

    /**
     * The rail on the left edge resizes the dock. The pointer listeners only
     * exist during the drag, and outside Angular's zone, because a
     * document-wide `mousemove` listener held for good would run change
     * detection on every pointer move anywhere in the window.
     */
    startResize (event: MouseEvent): void {
        if (event.button !== 0) {
            return
        }
        event.preventDefault()
        this.startX = event.clientX
        this.startWidth = this.width
        this.zone.runOutsideAngular(() => {
            const move = (e: MouseEvent): void => {
                // The rail is on the left edge, so dragging left widens the dock.
                const wanted = this.startWidth - (e.clientX - this.startX)
                this.applyWidth(Math.min(Math.max(wanted, MIN_WIDTH), SidebarPlusSftpDockComponent.windowCap()))
                this.scheduleSave()
            }
            const up = (): void => {
                this.stopDragging?.()
                this.flushSave()
            }
            document.addEventListener('mousemove', move)
            document.addEventListener('mouseup', up)
            this.stopDragging = () => {
                document.removeEventListener('mousemove', move)
                document.removeEventListener('mouseup', up)
                this.stopDragging = null
            }
        })
    }

    private applyWidth (width: number): void {
        this.width = width
        this.element.nativeElement.style.width = `${width}px`
    }

    private scheduleSave (): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer)
        }
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null
            SidebarPlusSftpDockComponent.writeWidth(this.width)
        }, SAVE_DELAY_MS)
    }

    private flushSave (): void {
        if (!this.saveTimer) {
            return
        }
        clearTimeout(this.saveTimer)
        this.saveTimer = null
        SidebarPlusSftpDockComponent.writeWidth(this.width)
    }

    private static windowCap (): number {
        return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(window.innerWidth * MAX_WINDOW_SHARE)))
    }

    private static readWidth (): number {
        const raw = parseInt(window.localStorage[WIDTH_KEY] ?? '', 10)
        return Number.isFinite(raw) ? Math.min(Math.max(raw, MIN_WIDTH), MAX_WIDTH) : DEFAULT_WIDTH
    }

    private static writeWidth (width: number): void {
        window.localStorage[WIDTH_KEY] = width.toString()
    }
}
