import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { SidebarPlusI18nService } from '../i18n'

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
    /**
     * Set from the constructor rather than a field initializer: every real
     * caller overwrites this right after `ngbModal.open()`, but the default
     * still has to go through the same translation table as everything else,
     * which needs `i18n` injected first.
     */
    @Input() confirmLabel: string
    @Input() danger = true
    /** Which button `Entrée` activates. The caller decides — this component has no opinion on how destructive its own confirmation is — and the fallback is the harmless answer. */
    @Input() defaultButton: 'confirm'|'cancel' = 'cancel'

    @ViewChild('confirmButton') confirmButton: ElementRef<HTMLButtonElement>
    @ViewChild('cancelButton') cancelButton: ElementRef<HTMLButtonElement>

    constructor (
        private modalInstance: NgbActiveModal,
        private i18n: SidebarPlusI18nService,
    ) {
        this.confirmLabel = this.i18n.t('Confirm')
    }

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
