import './sftpBrowser.component.scss'
import { filesize } from 'filesize'
import { Component, Inject } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NotificationsService, PlatformService } from 'tabby-core'
import { SFTPContextMenuItemProvider, SFTPFile, SFTPPanelComponent } from 'tabby-ssh'

/**
 * Tabby's own SFTP panel with this plugin's presentation.
 *
 * Subclassing rather than reimplementing: every behaviour worth having —
 * navigation, open, upload/download, the context menu, the filter, transfer
 * plumbing — is inherited untouched from `SFTPPanelComponent`, and only the
 * template is ours. What forced the split is that the native template renders
 * the date through the `tabbyDate` pipe, the permissions through
 * `getModeString()`, and carries no `title` anywhere: all of that is template
 * content, unreachable from a stylesheet, and patching the DOM instead would
 * just be overwritten on the next change detection pass.
 *
 * The native row also puts an `*ngIf` on its size cell, so directories have
 * one fewer child than files and the columns cannot line up. Ours is a CSS
 * grid with fixed column tracks, so a directory simply leaves its size track
 * empty and everything stays aligned at any width.
 */
@Component({
    selector: 'sidebar-plus-sftp-browser',
    template: require('./sftpBrowser.component.pug'),
})
export class SidebarPlusSftpBrowserComponent extends SFTPPanelComponent {
    // Declared explicitly rather than relying on Angular inheriting the
    // parent's factory: the parameters are the contract with SSHModule's
    // providers, and spelling them out keeps a future change in tabby-ssh a
    // compile error instead of a runtime injection failure.
    constructor (
        ngbModal: NgbModal,
        notifications: NotificationsService,
        platform: PlatformService,
        @Inject(SFTPContextMenuItemProvider) contextMenuProviders: SFTPContextMenuItemProvider[],
    ) {
        super(ngbModal, notifications, platform, contextMenuProviders)
    }

    // The getters and thin wrappers below exist so the template never has to
    // contain a string literal. Pug delimits attribute values with one quote
    // style and HTML-entity-escapes the other inside them, which mangles
    // Angular expressions — the same trap already worked around in
    // SidebarPlusTreeComponent (piège #20-ish: `contextMenuMode === "icon"`
    // reaching Angular as `&quot;icon&quot;`).
    get canGoUp (): boolean {
        return this.path !== '/'
    }

    get hasActiveFilter (): boolean {
        return this.showFilter && this.filterText.trim() !== ''
    }

    get filterFoundNothing (): boolean {
        return this.fileList !== null && this.filteredFileList.length === 0 && this.hasActiveFilter
    }

    goRoot (): void {
        void this.navigate('/')
    }

    /** Empty for directories — a folder has no meaningful byte size here. */
    sizeCell (item: SFTPFile): string {
        return item.isDirectory ? '' : this.humanSize(item.size)
    }

    /** Date only, no time — the full timestamp lives in the row tooltip. */
    shortDate (value: Date): string {
        const d = value instanceof Date ? value : new Date(value)
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString()
    }

    /** Permissions as the octal triplet (`755`, `644`), the form actually used when typing a chmod. */
    octalMode (item: SFTPFile): string {
        // eslint-disable-next-line no-bitwise
        return (item.mode & 0o777).toString(8).padStart(3, '0')
    }

    humanSize (bytes: number): string {
        return filesize(bytes, { round: 1 }) as string
    }

    /**
     * Everything the columns had to drop to stay narrow: full name, exact
     * size, complete timestamp, and the long `drwxr-xr-x` form alongside the
     * octal one.
     */
    rowTooltip (item: SFTPFile): string {
        const lines = [item.name]
        if (!item.isDirectory) {
            lines.push(`Taille : ${this.humanSize(item.size)} (${item.size.toLocaleString()} octets)`)
        }
        const d = item.modified instanceof Date ? item.modified : new Date(item.modified)
        if (!isNaN(d.getTime())) {
            lines.push(`Modifié : ${d.toLocaleString()}`)
        }
        lines.push(`Permissions : ${this.octalMode(item)} — ${this.getModeString(item)}`)
        if (item.isSymlink) {
            lines.push('Lien symbolique')
        }
        return lines.join('\n')
    }
}
