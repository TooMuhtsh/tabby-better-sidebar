import { Component, Input } from '@angular/core'
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
export class ConfirmModalComponent {
    @Input() message: string
    @Input() confirmLabel = 'Confirmer'
    @Input() danger = true

    constructor (
        private modalInstance: NgbActiveModal,
    ) { }

    confirm (): void {
        this.modalInstance.close(true)
    }

    cancel (): void {
        this.modalInstance.close(false)
    }
}
