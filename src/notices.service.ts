import { Injectable } from '@angular/core'
import { ToastrService } from 'ngx-toastr'

/**
 * How long a notice stays up. Tabby's own `notice()` hard-codes
 * `timeOut: 1000` — one second, which is fine for "copied to clipboard" and far
 * too short for anything the user has to act on: "the file changed on the
 * server", "re-drag it to get the current version". Those were being missed.
 */
const NOTICE_TIMEOUT = 8000

/** Errors stay longer still: they usually carry a server message worth reading. */
const ERROR_TIMEOUT = 15000

/**
 * Notifications that last long enough to be read.
 *
 * Goes to `ToastrService` directly rather than to `NotificationsService`, whose
 * `notice()` fixes the duration and offers no way to change it. The service is
 * the very one Tabby injects — `ngx-toastr` is a webpack external — so these
 * toasts stack with Tabby's own and look identical; only the timing differs.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusNoticesService {
    constructor (private toastr: ToastrService) { }

    notice (text: string, details?: string): void {
        this.toastr.info(text, details, { timeOut: NOTICE_TIMEOUT })
    }

    error (text: string, details?: string): void {
        this.toastr.error(text, details, { timeOut: ERROR_TIMEOUT })
    }
}
