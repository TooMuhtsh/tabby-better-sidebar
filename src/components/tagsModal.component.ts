import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

/**
 * The tags of one profile, edited as text in a centred modal.
 *
 * Taken from the miller806 fork (commit b1bc527). Same shape as the note
 * modal, so it behaves the same way: Ctrl+Enter saves, Escape cancels. The
 * text is handed back as typed, and the caller splits and cleans it with
 * `parseTagsInput()`.
 */
@Component({
    selector: 'sidebar-plus-tags-modal',
    template: require('./tagsModal.component.pug'),
})
export class TagsModalComponent implements AfterViewInit {
    @Input() targetName = ''
    @Input() text = ''

    @ViewChild('field') field: ElementRef<HTMLTextAreaElement>

    constructor (
        private modalInstance: NgbActiveModal,
    ) { }

    /** Deferred like the note modal's focus, since NgbModal is still fading in. Caret at the end, to add a tag. */
    ngAfterViewInit (): void {
        setTimeout(() => {
            const el = this.field?.nativeElement
            el?.focus()
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
