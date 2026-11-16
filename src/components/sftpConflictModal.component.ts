import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { SidebarPlusI18nService } from '../i18n'
import { ConflictAnswer, ConflictChoice } from '../remoteNames'

/**
 * The question a name collision of the SFTP clipboard asks, in this plugin's
 * own HTML modal rather than a native dialog (piège #42).
 *
 * Keep both, Overwrite, Skip. Overwrite is only shown when the caller says the
 * collision allows it (a file onto a regular file). Nothing destructive is a
 * default: Enter keeps both, Esc skips, and dismissing the modal any other way
 * reads as Skip at the caller.
 */
@Component({
    selector: 'sidebar-plus-conflict-modal',
    template: require('./sftpConflictModal.component.pug'),
})
export class SftpConflictModalComponent implements OnInit, AfterViewInit {
    /** The name that is already taken. */
    @Input() name = ''
    /** Where it is taken, so the question is about a place and not just a name. */
    @Input() destination = ''
    /** Whether Overwrite is offered at all. */
    @Input() canOverwrite = false
    /** True when more collisions wait behind this one, see `applyToAll`. */
    @Input() many = false

    applyToAll = false

    headline = ''
    detail = ''
    readonly renameLabel: string
    readonly overwriteLabel: string
    readonly skipLabel: string
    readonly applyAllLabel: string

    @ViewChild('renameButton') renameButton: ElementRef<HTMLButtonElement>

    constructor (private modalInstance: NgbActiveModal, private i18n: SidebarPlusI18nService) {
        this.renameLabel = this.i18n.t('Keep both')
        this.overwriteLabel = this.i18n.t('Overwrite')
        this.skipLabel = this.i18n.t('Skip')
        this.applyAllLabel = this.i18n.t('Do this for the remaining files')
    }

    /**
     * Composed here, not in the constructor, because the caller sets the
     * inputs right after `open()` and a message built at construction would
     * name nothing.
     */
    ngOnInit (): void {
        this.headline = this.i18n.t('"{name}" already exists in {destination}.', {
            name: this.name,
            destination: this.destination,
        })
        this.detail = this.canOverwrite
            ? this.i18n.t('"Keep both" gives the pasted file a new name. "Overwrite" replaces the one on the server.')
            : this.i18n.t('"Keep both" gives the pasted item a new name. Overwriting is only offered for a file replacing another file.')
    }

    ngAfterViewInit (): void {
        // NgbModal fades its window in, and focusing an element that is still
        // animating in silently does nothing.
        setTimeout(() => this.renameButton?.nativeElement.focus())
    }

    rename (): void {
        this.answer('rename')
    }

    overwrite (): void {
        if (this.canOverwrite) {
            this.answer('overwrite')
        }
    }

    skip (): void {
        this.answer('skip')
    }

    private answer (choice: ConflictChoice): void {
        const answer: ConflictAnswer = { choice, applyToAll: this.applyToAll }
        this.modalInstance.close(answer)
    }
}
