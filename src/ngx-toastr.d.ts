// `ngx-toastr` is a webpack external: Tabby supplies it at runtime, so the
// import resolves to *its* module — the same instance its own notifications
// use — and nothing is bundled here. Only the types are missing, and only the
// two methods this plugin calls are declared rather than pulling in the whole
// package as a devDependency for a pair of signatures.
declare module 'ngx-toastr' {
    export interface ToastConfig {
        /** Milliseconds before the toast fades. 0 keeps it until dismissed. */
        timeOut?: number
        extendedTimeOut?: number
        closeButton?: boolean
        disableTimeOut?: boolean
    }

    export class ToastrService {
        info (message?: string, title?: string, config?: ToastConfig): unknown
        error (message?: string, title?: string, config?: ToastConfig): unknown
    }
}
