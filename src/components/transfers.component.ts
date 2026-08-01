import './transfers.component.scss'
import { filesize } from 'filesize'
import { Component } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { SidebarPlusTransfersService, TransferEntry } from '../transfersRegistry.service'
import { ConfirmModalComponent } from './confirmModal.component'

/**
 * The transfer list, at the bottom of the sidebar.
 *
 * Deliberately compact — one line per transfer, no progress bar: the SFTP
 * design settled on a sober row (state, percentage, speed) back on 2026-07-29,
 * and the user asked for entries small enough to fit more of them in the same
 * space. The list scrolls past its cap rather than growing into the tree.
 *
 * Hidden entirely when there is nothing to show, like the active sessions and
 * tunnels blocks above it.
 */
@Component({
    selector: 'sidebar-plus-transfers',
    template: require('./transfers.component.pug'),
})
export class SidebarPlusTransfersComponent {
    collapsed = window.localStorage.sidebarPlusTransfersCollapsed === 'true'

    constructor (
        public transfers: SidebarPlusTransfersService,
        private ngbModal: NgbModal,
    ) { }

    toggle (event: MouseEvent): void {
        event.preventDefault()
        this.collapsed = !this.collapsed
        window.localStorage.sidebarPlusTransfersCollapsed = this.collapsed ? 'true' : 'false'
    }

    /** `0 B/s` while a transfer is starting reads as broken; blank reads as "not yet". */
    speedLabel (entry: TransferEntry): string {
        return entry.state === 'active' && entry.speed > 0 ? `${filesize(entry.speed)}/s` : ''
    }

    sizeLabel (entry: TransferEntry): string {
        return entry.size > 0 ? String(filesize(entry.size)) : ''
    }

    remove (entry: TransferEntry, event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        this.transfers.remove(entry)
    }

    /**
     * Asks before clearing when something is still running, because clearing
     * cancels it. With nothing active there is nothing to lose, so no question.
     */
    async clear (event: MouseEvent): Promise<void> {
        event.preventDefault()
        const active = this.transfers.activeCount
        if (active > 0) {
            const modal = this.ngbModal.open(ConfirmModalComponent)
            modal.componentInstance.message = active === 1
                ? 'Un transfert est encore en cours. Vider la liste l\'annulera. Continuer ?'
                : `${active} transferts sont encore en cours. Vider la liste les annulera. Continuer ?`
            modal.componentInstance.confirmLabel = 'Vider et annuler'
            modal.componentInstance.defaultButton = 'cancel'
            if (!await modal.result.catch(() => false)) {
                return
            }
        }
        this.transfers.clear()
    }

    trackById (_index: number, entry: TransferEntry): number {
        return entry.id
    }
}
