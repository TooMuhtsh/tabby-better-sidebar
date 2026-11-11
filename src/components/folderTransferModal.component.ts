import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

/** One destination in the folder move/copy dialog; null means the tree root. */
export interface FolderTransferDestination {
    id: string|null
    value: string
    label: string
}

/**
 * Keyboard-accessible alternative to dragging profile folders.
 *
 * The destination is a native select; no changes are made until the user
 * activates the explicit confirmation button. Escape and Cancel dismiss.
 */
@Component({
    selector: 'sidebar-plus-folder-transfer-modal',
    template: require('./folderTransferModal.component.pug'),
})
export class FolderTransferModalComponent implements AfterViewInit {
    @Input() action: 'move'|'copy' = 'move'
    @Input() sourceName = ''
    @Input() destinations: FolderTransferDestination[] = []
    @Input() selectedDestination = ''

    @ViewChild('destinationSelect') destinationSelect: ElementRef<HTMLSelectElement>

    constructor (private modal: NgbActiveModal) { }

    ngAfterViewInit (): void {
        setTimeout(() => this.destinationSelect?.nativeElement.focus())
    }

    get canConfirm (): boolean {
        return this.destinations.some(destination => destination.value === this.selectedDestination)
    }

    confirm (): void {
        const destination = this.destinations.find(item => item.value === this.selectedDestination)
        if (destination) {
            this.modal.close(destination)
        }
    }

    cancel (): void {
        this.modal.dismiss()
    }
}
