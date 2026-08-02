import './hostChrome.scss'
import { ApplicationRef, ComponentRef, EnvironmentInjector, Injectable, createComponent } from '@angular/core'
import { AppService, ConfigService } from 'tabby-core'
import { SidebarPlusTreeComponent } from './components/sidebarTree.component'

/** Set on `body` while Tabby's own transfers menu is to stay out of the way. */
const HIDE_NATIVE_TRANSFERS_CLASS = 'sidebar-plus-hide-native-transfers'

@Injectable({ providedIn: 'root' })
export class SidebarPlusMountService {
    private componentRef: ComponentRef<SidebarPlusTreeComponent>|null = null

    constructor (
        private appRef: ApplicationRef,
        private environmentInjector: EnvironmentInjector,
        private app: AppService,
        private config: ConfigService,
    ) {
        this.app.ready$.subscribe(() => {
            this.sync()
            this.config.changed$.subscribe(() => this.sync())
        })
    }

    private sync (): void {
        const enabled = this.config.store.sidebarPlus?.enabled ?? true
        if (enabled) {
            this.mount()
        } else {
            this.unmount()
        }
        // Conditioned on `enabled` too, not on the setting alone: a plugin that
        // is switched off has no business still hiding a piece of the host's UI,
        // and its own transfer panel is gone at that point anyway.
        const hide = enabled && (this.config.store.sidebarPlus?.hideNativeTransfersMenu ?? true)
        document.body.classList.toggle(HIDE_NATIVE_TRANSFERS_CLASS, hide)
    }

    private mount (): void {
        if (this.componentRef) {
            return
        }
        const container = document.querySelector('.window.h-100.d-flex')
        if (!container) {
            return
        }
        this.componentRef = createComponent(SidebarPlusTreeComponent, {
            environmentInjector: this.environmentInjector,
        })
        this.appRef.attachView(this.componentRef.hostView)
        container.insertBefore(this.rootNodeOf(this.componentRef), container.firstChild)
    }

    /**
     * Takes the sidebar back out — of the DOM as well as of Angular.
     *
     * `.remove()` is not a precaution: `ComponentRef.destroy()` does **not**
     * touch the DOM here. Angular's default DOM renderer leaves `destroyNode`
     * null, so destroying a view built by `createComponent()` and inserted by
     * hand leaves that node exactly where it was put. Switching the plugin off
     * therefore left a frozen, unresponsive sidebar on screen, and switching it
     * back on inserted a *second* one next to the corpse — the mount above only
     * checks its own reference, which had been cleared. The SFTP panel does the
     * same thing in `destroyPanel()`, for the same reason.
     */
    private unmount (): void {
        if (!this.componentRef) {
            return
        }
        this.rootNodeOf(this.componentRef).remove()
        this.appRef.detachView(this.componentRef.hostView)
        this.componentRef.destroy()
        this.componentRef = null
    }

    private rootNodeOf (ref: ComponentRef<SidebarPlusTreeComponent>): HTMLElement {
        return (ref.hostView as unknown as { rootNodes: HTMLElement[] }).rootNodes[0]
    }
}
