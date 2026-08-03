import './hostChrome.scss'
import { ApplicationRef, ComponentRef, EnvironmentInjector, Injectable, createComponent } from '@angular/core'
import { AppService, ConfigService, NotificationsService } from 'tabby-core'
import { SidebarPlusTreeComponent } from './components/sidebarTree.component'
import { checkHost } from './hostCompat'

/** Set on `body` while Tabby's own transfers menu is to stay out of the way. */
const HIDE_NATIVE_TRANSFERS_CLASS = 'sidebar-plus-hide-native-transfers'

@Injectable({ providedIn: 'root' })
export class SidebarPlusMountService {
    private componentRef: ComponentRef<SidebarPlusTreeComponent>|null = null

    /**
     * Whether the host failed a precondition that leaves nothing to mount.
     *
     * Only the fatal verdict is kept. The per-feature detail is reported to the
     * user and to the console, but nothing consumes it programmatically yet:
     * retiring a single block (hiding the SFTP toggle when `SFTPPanelComponent`
     * is gone) needs a way to switch a block off, which is what the
     * "Interrupteurs par bloc" chantier builds. Storing the list here now would
     * be a second, unused mechanism racing the one that is coming.
     */
    private hostFatal = false

    constructor (
        private appRef: ApplicationRef,
        private environmentInjector: EnvironmentInjector,
        private app: AppService,
        private config: ConfigService,
        private notifications: NotificationsService,
    ) {
        this.app.ready$.subscribe(() => {
            this.verifyHost()
            this.sync()
            this.config.changed$.subscribe(() => this.sync())
        })
    }

    /**
     * Checks what this plugin needs from Tabby, and says so **once**.
     *
     * Run from `ready$` rather than the constructor: one of the preconditions
     * is a DOM container, which does not exist before the host has rendered.
     * And once only — `sync()` re-runs on every `config.changed$`, so reporting
     * from there would turn a broken host into a stream of toasts.
     */
    private verifyHost (): void {
        const report = checkHost()
        this.hostFatal = report.fatal
        if (!report.failed.length) {
            return
        }

        const lost = report.failed.map(p => p.feature).join(', ')
        // console.error as well as the toast: a notification is gone in
        // seconds, and this is exactly the kind of failure someone comes back
        // to diagnose later.
        console.error(
            '[tabby-better-sidebar] Contrôle de compatibilité échoué :',
            report.failed.map(p => p.id).join(', '),
            '— cette version de Tabby ne fournit plus ce que le plugin attend.',
        )
        // Pas de liste dans le cas fatal : ce qui est perdu, c'est tout, et
        // énumérer « la sidebar elle-même » entre parenthèses se lit comme une
        // restriction alors que c'en est le contraire.
        this.notifications.error(
            report.fatal
                ? 'tabby-better-sidebar ne peut pas démarrer sur cette version de Tabby — voir la console pour le détail'
                : `tabby-better-sidebar : ${lost} — indisponible sur cette version de Tabby`,
        )
    }

    private sync (): void {
        // A fatal precondition means there is nothing to mount into. Keep
        // unmounting reachable so the host is still left as it was found.
        const enabled = !this.hostFatal && (this.config.store.sidebarPlus?.enabled ?? true)
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
            // verifyHost() has already reported this as fatal, and `sync()`
            // will not have called us. Reaching here means the container went
            // away *after* startup — nothing to say twice, but never a silent
            // return either.
            console.error('[tabby-better-sidebar] Conteneur de montage introuvable, sidebar non montée.')
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
