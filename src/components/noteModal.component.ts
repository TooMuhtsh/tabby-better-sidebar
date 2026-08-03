import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

/**
 * The memo of one profile or folder, edited in a centred modal.
 *
 * A modal rather than a popup anchored to the cursor, for the reason the
 * snippet editor established: a note is free text over several lines, and a
 * 300px box hanging off the mouse is the wrong place to write it.
 */
@Component({
    selector: 'sidebar-plus-note-modal',
    template: require('./noteModal.component.pug'),
})
export class NoteModalComponent implements AfterViewInit {
    @Input() targetName = ''
    @Input() text = ''

    @ViewChild('field') field: ElementRef<HTMLTextAreaElement>

    constructor (
        private modalInstance: NgbActiveModal,
    ) { }

    /**
     * Deferred by a `setTimeout`, like the confirmation modal's own focus:
     * NgbModal fades its window in, and focusing an element still animating in
     * silently does nothing.
     */
    ngAfterViewInit (): void {
        setTimeout(() => {
            const el = this.field?.nativeElement
            el?.focus()
            // Caret at the end rather than selecting everything: reopening a
            // note is usually to add to it, and a stray keystroke on a full
            // selection would wipe it.
            el?.setSelectionRange(el.value.length, el.value.length)
        })
    }

    save (): void {
        this.modalInstance.close(this.text)
    }

    cancel (): void {
        this.modalInstance.dismiss()
    }
}
