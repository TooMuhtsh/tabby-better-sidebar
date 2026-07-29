import './sftpBrowser.component.scss'
import { filesize } from 'filesize'
import { Component, Inject } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, LocaleService, NotificationsService, PlatformService } from 'tabby-core'
import { SFTPContextMenuItemProvider, SFTPFile, SFTPPanelComponent } from 'tabby-ssh'

/** An optional column of the file list. The name column is not one of these — it is always shown. */
export interface SftpColumn {
    id: string
    /** Header caption. Kept short: the whole list lives in a ~300px sidebar. */
    label: string
    /** Full wording for the column chooser, where there is room for it. */
    description: string
    /** A fixed grid track — fixed is the point, it is what keeps the columns aligned at any width. */
    width: string
}

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
    /**
     * Everything `SFTPFile` can actually answer — it carries only name,
     * fullPath, isDirectory, isSymlink, mode, size and modified, so there is
     * no owner/group column to offer however much an SFTP client usually has
     * one.
     */
    static readonly AVAILABLE_COLUMNS: SftpColumn[] = [
        { id: 'size', label: 'Taille', description: 'Taille du fichier', width: '3.9rem' },
        { id: 'date', label: 'Date', description: 'Date de modification', width: '4.5rem' },
        { id: 'mode', label: 'Perm.', description: 'Permissions en octal (755)', width: '2.1rem' },
        { id: 'modeLong', label: 'Droits', description: 'Permissions en format long (drwxr-xr-x)', width: '5.2rem' },
        { id: 'type', label: 'Type', description: 'Nature de l’élément', width: '4rem' },
        { id: 'ext', label: 'Ext.', description: 'Extension du fichier', width: '2.6rem' },
    ]

    availableColumns = SidebarPlusSftpBrowserComponent.AVAILABLE_COLUMNS
    /** Toggles the inline column chooser. Inline, not a floating popup: a dropdown in a 300px sidebar would need positioning and outside-click handling (piège #15) for no gain. */
    showColumnChooser = false

    // Declared explicitly rather than relying on Angular inheriting the
    // parent's factory: the parameters are the contract with SSHModule's
    // providers, and spelling them out keeps a future change in tabby-ssh a
    // compile error instead of a runtime injection failure.
    constructor (
        private config: ConfigService,
        private locale: LocaleService,
        ngbModal: NgbModal,
        notifications: NotificationsService,
        platform: PlatformService,
        @Inject(SFTPContextMenuItemProvider) contextMenuProviders: SFTPContextMenuItemProvider[],
    ) {
        super(ngbModal, notifications, platform, contextMenuProviders)
    }

    ////// COLUMNS //////
    /** Configured columns, in the order declared in AVAILABLE_COLUMNS, ignoring ids that no longer exist. */
    get visibleColumns (): SftpColumn[] {
        const selected: string[] = this.config.store.sidebarPlus?.sftpColumns ?? []
        return this.availableColumns.filter(c => selected.includes(c.id))
    }

    /**
     * Both the header and every row carry this, rather than the grid being
     * declared once on the container with rows as `display: contents` — a row
     * that generates no box cannot take a hover background or a bottom border.
     */
    get gridTemplate (): string {
        return ['1.15rem', 'minmax(0, 1fr)', ...this.visibleColumns.map(c => c.width)].join(' ')
    }

    isColumnVisible (column: SftpColumn): boolean {
        return this.visibleColumns.some(c => c.id === column.id)
    }

    toggleColumn (column: SftpColumn): void {
        const selected: string[] = [...(this.config.store.sidebarPlus?.sftpColumns ?? [])]
        const at = selected.indexOf(column.id)
        if (at === -1) {
            selected.push(column.id)
        } else {
            selected.splice(at, 1)
        }
        this.config.store.sidebarPlus.sftpColumns = selected
        this.config.save()
    }

    cellValue (column: SftpColumn, item: SFTPFile): string {
        switch (column.id) {
            case 'size':
                // A directory's own byte size says nothing useful about it.
                return item.isDirectory ? '' : this.humanSize(item.size)
            case 'date':
                return this.shortDate(item.modified)
            case 'mode':
                return this.octalMode(item)
            case 'modeLong':
                return this.longMode(item)
            case 'type':
                return this.typeLabel(item)
            case 'ext':
                return this.extension(item)
            default:
                return ''
        }
    }

    ////// FORMATTING //////
    /**
     * Date only, no time — the full timestamp lives in the row tooltip.
     *
     * The locale is taken from Tabby rather than left to the JS default:
     * Electron reports en-US whatever the OS says, which would put `7/23/2026`
     * in an otherwise French panel — and, worse, silently swap day and month.
     */
    shortDate (value: Date): string {
        const d = value instanceof Date ? value : new Date(value)
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString(this.locale.getLocale())
    }

    fullDate (value: Date): string {
        const d = value instanceof Date ? value : new Date(value)
        return isNaN(d.getTime()) ? '' : d.toLocaleString(this.locale.getLocale())
    }

    /** Permissions as the octal triplet (`755`, `644`), the form actually used when typing a chmod. */
    octalMode (item: SFTPFile): string {
        // eslint-disable-next-line no-bitwise
        return (item.mode & 0o777).toString(8).padStart(3, '0')
    }

    /**
     * The `drwxrwxr-x` form, computed here rather than through the inherited
     * `getModeString()`.
     *
     * That one masks `item.mode` against Node's `constants.S_IXUSR`,
     * `S_IRGRP`, `S_IWOTH` and friends — and **Windows only defines
     * `S_IRUSR`, `S_IWUSR` and `S_IFDIR`**. The rest come back `undefined`,
     * `mode & undefined` is 0, and every one of those bits renders as a dash:
     * a 775 directory displays as `drw-------` on Windows, regardless of its
     * real permissions. Verified against this very panel on 2026-07-29.
     */
    longMode (item: SFTPFile): string {
        const type = item.isDirectory ? 'd' : item.isSymlink ? 'l' : '-'
        const flags = 'rwxrwxrwx'
        let out = type
        for (let i = 0; i < flags.length; i++) {
            // Bit 8 is the owner's read flag (0o400) down to bit 0, other's execute.
            // eslint-disable-next-line no-bitwise
            out += item.mode & 1 << flags.length - 1 - i ? flags[i] : '-'
        }
        return out
    }

    humanSize (bytes: number): string {
        return filesize(bytes, { round: 1 }) as string
    }

    typeLabel (item: SFTPFile): string {
        if (item.isSymlink) {
            return 'Lien'
        }
        if (item.isDirectory) {
            return 'Dossier'
        }
        const ext = this.extension(item)
        return ext === '' ? 'Fichier' : ext.toUpperCase()
    }

    extension (item: SFTPFile): string {
        if (item.isDirectory) {
            return ''
        }
        // A leading dot is the name of a hidden file, not an extension:
        // `.bashrc` has none.
        const at = item.name.lastIndexOf('.')
        return at > 0 ? item.name.slice(at + 1) : ''
    }

    /** Dotfiles, dimmed rather than hidden — the panel has no "show hidden" toggle to get them back. */
    isHidden (item: SFTPFile): boolean {
        return item.name.startsWith('.')
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
        const modified = this.fullDate(item.modified)
        if (modified !== '') {
            lines.push(`Modifié : ${modified}`)
        }
        lines.push(`Permissions : ${this.octalMode(item)} — ${this.longMode(item)}`)
        lines.push(`Type : ${this.typeLabel(item)}`)
        if (item.isSymlink) {
            lines.push('Lien symbolique')
        }
        return lines.join('\n')
    }

    ////// TEMPLATE HELPERS //////
    // The getters and thin wrappers below exist so the template never has to
    // contain a string literal. Pug delimits attribute values with one quote
    // style and HTML-entity-escapes the other inside them, which mangles
    // Angular expressions — the same trap already worked around in
    // SidebarPlusTreeComponent.
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
}
