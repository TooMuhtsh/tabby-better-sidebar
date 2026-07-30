import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

/**
 * Small yes/no modal, HTML/Bootstrap rather than a native OS dialog —
 * `platform.showMessageBox()` is a system confirm box, which is exactly what
 * every confirmation in this plugin is meant to avoid (piège #42).
 */
@Component({
    selector: 'sidebar-plus-confirm-modal',
    template: require('./confirmModal.component.pug'),
})
export class ConfirmModalComponent implements AfterViewInit {
    @Input() message: string
    @Input() confirmLabel = 'Confirmer'
    @Input() danger = true
    /** Which button `Entrée` activates. The caller decides — this component has no opinion on how destructive its own confirmation is — and the fallback is the harmless answer. */
    @Input() defaultButton: 'confirm'|'cancel' = 'cancel'

    @ViewChild('confirmButton') confirmButton: ElementRef<HTMLButtonElement>
    @ViewChild('cancelButton') cancelButton: ElementRef<HTMLButtonElement>

    constructor (
        private modalInstance: NgbActiveModal,
    ) { }

    /**
     * Puts the focus where `defaultButton` says, so `Entrée` activates it —
     * with 'confirm', `Suppr` then `Entrée` is one gesture (user request,
     * 2026-07-30, made configurable right after).
     *
     * Deferred by a `setTimeout`: NgbModal fades its window in, and focusing
     * an element that is still animating in silently does nothing. `Échap`
     * cancels either way, through NgbModal's own dismiss.
     */
    ngAfterViewInit (): void {
        const target = this.defaultButton === 'cancel' ? this.cancelButton : this.confirmButton
        setTimeout(() => target?.nativeElement.focus())
    }

    confirm (): void {
        this.modalInstance.close(true)
    }

    cancel (): void {
        this.modalInstance.close(false)
    }
}
