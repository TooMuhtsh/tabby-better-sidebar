import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'
import { ConfigService } from 'tabby-core'

/** Where the SFTP view is rendered. */
export type SftpPlacement = 'sidebar' | 'right'

/**
 * Where the SFTP view lives, and whether the right-hand dock is open.
 *
 * The same view has two possible hosts. The sidebar, where it replaces the
 * profile tree, is the historical placement and the default. The other one is
 * a full-height column docked on the right of the window, with
 * `sidebarPlus.sftpPlacement` set to `right`. Only one of them exists at a
 * time. The panels behind the view are shared through
 * SidebarPlusSftpPanelCacheService, so going from one host to the other never
 * opens a second SFTP channel for a session.
 *
 * `dockOpen` is session state and is never persisted, for the same reason as
 * the sidebar's own SFTP mode. The view only makes sense next to the session
 * it was opened for, and that session is gone after a restart. Plain fields
 * rather than observables, because every writer is a click, which runs inside
 * the Angular zone, so a change detection pass follows on its own.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusSftpViewService {
    /** Whether the right-hand dock is showing. Meaningless in the sidebar placement. */
    dockOpen = false

    /**
     * Emits when a gesture names one session explicitly (the SFTP shortcut of
     * an active session row), so the dock's panel drops a freeze left standing
     * from an earlier navigation. The tree reaches the sidebar host directly
     * as a ViewChild, but the dock is not its child.
     */
    readonly unfreezeRequested = new Subject<void>()

    constructor (private config: ConfigService) { }

    /**
     * `sidebar` unless the configuration explicitly asks for `right`. A
     * configuration written before this setting existed has no key at all,
     * and must keep the view where it always was.
     */
    get placement (): SftpPlacement {
        return this.config.store.sidebarPlus?.sftpPlacement === 'right' ? 'right' : 'sidebar'
    }

    get inDock (): boolean {
        return this.placement === 'right'
    }

    show (): void {
        this.dockOpen = true
    }

    hide (): void {
        this.dockOpen = false
    }
}
