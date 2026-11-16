import { ApplicationRef, ComponentRef, Injectable } from '@angular/core'
import { Subject } from 'rxjs'
import { SSHTabComponent } from 'tabby-ssh'
import type { SidebarPlusSftpBrowserComponent } from './components/sftpBrowser.component'

type PanelRef = ComponentRef<SidebarPlusSftpBrowserComponent>

/**
 * The SFTP browsers of the SFTP view, one per SSH tab, shared by whichever
 * host shows the view (the sidebar, or the right-hand dock).
 *
 * The cache used to live inside SidebarPlusSftpComponent. That was right while
 * the sidebar was its only host, and stopped being right once the view could
 * move, because destroying the host destroyed every browser in it and the next
 * host built new ones. Each browser opens its own SFTP channel when it is
 * created, and `SFTPSession` has no `close()`, so the channel only dies with
 * the SSH session. Switching the placement back and forth would have opened
 * one more channel per browsed session each time, until OpenSSH's limit of 10
 * sessions per connection refused the next one. Held here, a browser outlives
 * its host. The old host detaches it, the new one attaches the same instance,
 * and the session keeps a single channel.
 *
 * Ownership is explicit. A host only detaches a browser that is still inside
 * its own container, so a host on its way out can never pull a browser away
 * from the host that has just taken it over.
 *
 * Emptied by destroyAll(), which SidebarPlusMountService calls when the plugin
 * or the SFTP view is switched off. Off still means released, as before, and
 * turning the view back on rebuilds from nothing.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusSftpPanelCacheService {
    /** One browser per SSH tab. See SidebarPlusSftpComponent for how it is kept in step with the tabs. */
    readonly panels = new Map<SSHTabComponent, PanelRef>()
    /** Last remote directory of each tab, so a rebuilt browser resumes where the old one was. */
    readonly lastPaths = new Map<SSHTabComponent, string>()
    /** Emits the browser whose own close button was pressed. Only the host showing it reacts. */
    readonly panelClosed = new Subject<PanelRef>()
    /** Emits after destroyAll(), so a host still alive forgets the browser it was showing. */
    readonly cleared = new Subject<void>()

    /** Browsers currently attached to the application's change detection. */
    private attached = new Set<PanelRef>()

    constructor (private appRef: ApplicationRef) { }

    /** Wires a freshly created browser into the cache. */
    register (tab: SSHTabComponent, ref: PanelRef): void {
        ref.instance.closed.subscribe(() => this.panelClosed.next(ref))
        this.panels.set(tab, ref)
    }

    /**
     * Puts a browser on screen inside `container`. Moving it from another
     * container is a plain DOM move, and the view is attached to change
     * detection only once whatever the number of moves.
     */
    attach (ref: PanelRef, container: HTMLElement): void {
        if (!this.attached.has(ref)) {
            this.appRef.attachView(ref.hostView)
            this.attached.add(ref)
        }
        container.appendChild(this.rootNodeOf(ref))
    }

    /**
     * Takes a browser off the screen and out of change detection, without
     * destroying it. A no-op when the browser is no longer in `container`,
     * because another host holds it now.
     */
    detach (ref: PanelRef, container: HTMLElement): void {
        const node = this.rootNodeOf(ref)
        if (node.parentElement !== container) {
            return
        }
        node.remove()
        this.appRef.detachView(ref.hostView)
        this.attached.delete(ref)
    }

    /**
     * `.remove()` first, because `ComponentRef.destroy()` does not touch the
     * DOM for a view built by `createComponent()` and inserted by hand.
     */
    destroyPanel (ref: PanelRef): void {
        this.rootNodeOf(ref).remove()
        this.appRef.detachView(ref.hostView)
        this.attached.delete(ref)
        ref.destroy()
    }

    /** Releases every browser. Called when the plugin or the SFTP view is switched off. */
    destroyAll (): void {
        if (!this.panels.size && !this.lastPaths.size) {
            return
        }
        for (const ref of this.panels.values()) {
            this.destroyPanel(ref)
        }
        this.panels.clear()
        this.lastPaths.clear()
        this.cleared.next()
    }

    private rootNodeOf (ref: PanelRef): HTMLElement {
        return (ref.hostView as unknown as { rootNodes: HTMLElement[] }).rootNodes[0]
    }
}
