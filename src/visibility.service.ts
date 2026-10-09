import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'

/**
 * Whether the sidebar is shown or tucked away by the toggle hotkey (#12).
 *
 * Hiding is *not* switching the plugin off. `sidebarPlus.enabled` unmounts the
 * component: the cached SFTP panels are destroyed with it, and each remount
 * opens a fresh SFTP channel that nothing closes (`SFTPSession` has no
 * `close()`, and OpenSSH caps a connection at 10 sessions); the filter, the
 * selection and the SFTP path are lost; and every press would be a synced
 * `config.save()`. Here the component stays mounted and is only taken off the
 * screen, so bringing it back finds everything where it was.
 *
 * Per machine, in localStorage, like the tree's width: having room on a laptop
 * screen says nothing about the desktop the config syncs to.
 *
 * A root service rather than a field of the tree component, because the SFTP
 * browser has to read it too — its auto-refresh has no reason to reread a
 * directory nobody can see.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusVisibilityService {
    /** Emits the new `hidden` value on every change. */
    readonly changed = new Subject<boolean>()

    private _hidden = window.localStorage.sidebarPlusHidden === '1'

    get hidden (): boolean {
        return this._hidden
    }

    toggle (): void {
        this.setHidden(!this._hidden)
    }

    setHidden (hidden: boolean): void {
        if (hidden === this._hidden) {
            return
        }
        this._hidden = hidden
        window.localStorage.sidebarPlusHidden = hidden ? '1' : '0'
        this.changed.next(hidden)
    }
}
