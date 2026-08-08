import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { SidebarPlusI18nService } from '../i18n'

import './pasteGroupModal.component.scss'

/** What the user chose to do about a folder of the same name already there. */
export type PasteResolution = 'suffix' | 'merge'

/**
 * Asked when "Coller le groupe" lands on a folder that already exists by that
 * name.
 *
 * Only then. A paste that collides with nothing goes straight through — the
 * user settled that on 2026-08-03: the question is worth a box, the paste
 * itself is not.
 *
 * The three outcomes are offered every time rather than fixed once in the
 * settings, because the right answer depends on the payload and not on a
 * preference: the same folder name can mean "I am restoring this from my other
 * machine" (merge) and "here is a second one like it" (suffix), and no default
 * gets both right.
 */
@Component({
    selector: 'sidebar-plus-paste-group-modal',
    template: require('./pasteGroupModal.component.pug'),
})
export class PasteGroupModalComponent implements AfterViewInit {
    /** The colliding folder's name, as it reads in the tree. */
    @Input() groupName = ''
    /** What the payload holds, already counted. */
    @Input() folders = 0
    @Input() profiles = 0
    /** The name a suffixing paste would use — shown so the choice is not blind. */
    @Input() suffixedName = ''
    /** What the purge took out, as a sentence, or empty. */
    @Input() purged = ''

    @ViewChild('suffixButton') suffixButton: ElementRef<HTMLButtonElement>

    constructor (
        private modalInstance: NgbActiveModal,
        private i18n: SidebarPlusI18nService,
    ) { }

    /**
     * The "folder already exists" sentence, with its `<strong>` markup bound
     * through `[innerHTML]` in the template — the only way to have the
     * collision's name rendered bold from a translated string.
     *
     * `groupName` is escaped BEFORE it reaches the translation table's ICU
     * substitution: `setTranslation()`'s value is ours, but the parameter is
     * a folder name the user typed, and ICU only splices it into the result
     * string verbatim. Skipping this would let a folder literally named
     * e.g. `<img onerror=...>` be read back as markup instead of text once
     * bound to `[innerHTML]`.
     */
    get collisionSentence (): string {
        const escaped = this.groupName
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        return this.i18n.t('A folder named <strong>{name}</strong> already exists at the root.', { name: escaped })
    }

    /**
     * Focus on the non-destructive answer, deferred by a `setTimeout` like the
     * confirmation and note modals: NgbModal fades its window in, and focusing
     * an element still animating in silently does nothing.
     *
     * Suffixing is the one that cannot lose anything — merging writes into a
     * folder that is already there — so it is where `Entrée` lands.
     */
    ngAfterViewInit (): void {
        setTimeout(() => this.suffixButton?.nativeElement.focus())
    }

    choose (resolution: PasteResolution): void {
        this.modalInstance.close(resolution)
    }

    cancel (): void {
        this.modalInstance.dismiss()
    }
}
