import './sftpBrowser.component.scss'
import { filesize } from 'filesize'
import { AfterViewChecked, Component, ElementRef, HostListener, Inject, OnDestroy } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, LocaleService, NotificationsService, PlatformService, PromptModalComponent } from 'tabby-core'
import { SFTPContextMenuItemProvider, SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { EmptyFileUpload } from '../sftpLocalTransfer'
import { SftpRemoteEditor } from '../sftpRemoteEdit'
import { clampInViewport } from '../viewport'
import { ConfirmModalComponent } from './confirmModal.component'

/** An optional column of the file list. The name column is not one of these — it is always shown. */
export interface SftpColumn {
    id: string
    /** Header caption. Kept short: the whole list lives in a ~300px sidebar. */
    label: string
    /** Full wording for the column chooser, where there is room for it. */
    description: string
    /** A fixed grid track — fixed is the point, it is what keeps the columns aligned at any width. */
    width: string
    /**
     * Right-aligned. Deliberately only the size: `4.2 MB` / `856 B` / `1.1 GB`
     * left-aligned in a 60px track makes magnitudes unscannable, which is the
     * one thing a size column is for. SFTP+ left-aligns everything; this is
     * the single place this panel departs from it.
     */
    numeric?: boolean
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
export class SidebarPlusSftpBrowserComponent extends SFTPPanelComponent implements OnDestroy, AfterViewChecked {
    /**
     * Everything `SFTPFile` can actually answer — it carries only name,
     * fullPath, isDirectory, isSymlink, mode, size and modified, so there is
     * no owner/group column to offer however much an SFTP client usually has
     * one.
     */
    static readonly AVAILABLE_COLUMNS: SftpColumn[] = [
        { id: 'size', label: 'Taille', description: 'Taille du fichier', width: '3.9rem', numeric: true },
        { id: 'date', label: 'Date', description: 'Date de modification', width: '4.5rem' },
        { id: 'mode', label: 'Perm.', description: 'Permissions en octal (755)', width: '2.1rem' },
        { id: 'modeLong', label: 'Droits', description: 'Permissions en format long (drwxr-xr-x)', width: '5.2rem' },
        { id: 'type', label: 'Type', description: 'Nature de l’élément', width: '4rem' },
        { id: 'ext', label: 'Ext.', description: 'Extension du fichier', width: '2.6rem' },
    ]

    availableColumns = SidebarPlusSftpBrowserComponent.AVAILABLE_COLUMNS

    /**
     * The display toggles that sit under the column list in the header menu,
     * modelled on SFTP+'s. Each is a `sidebarPlus` key, declared in the
     * ConfigProvider defaults (piège #16).
     */
    static readonly DISPLAY_TOGGLES = [
        { key: 'sftpFoldersFirst', label: 'Dossiers en premier' },
        { key: 'sftpShowHidden', label: 'Afficher les fichiers cachés' },
        { key: 'sftpColumnBorders', label: 'Bordures de colonnes' },
        { key: 'sftpZebra', label: 'Lignes alternées' },
    ]

    displayToggles = SidebarPlusSftpBrowserComponent.DISPLAY_TOGGLES

    // Declared explicitly rather than relying on Angular inheriting the
    // parent's factory: the parameters are the contract with SSHModule's
    // providers, and spelling them out keeps a future change in tabby-ssh a
    // compile error instead of a runtime injection failure.
    /** Full path of the selected entry, or null. Single selection only — there is no bulk action to justify more. */
    selectedPath: string|null = null

    private editor: SftpRemoteEditor

    // `notify`/`ngbModalService` rather than `notifications`/`ngbModal`: the
    // parent already holds *private* fields under those names, and
    // redeclaring one in a subclass is a type error — so the injected
    // instances have to be kept under names of our own to stay reachable.
    constructor (
        private config: ConfigService,
        private locale: LocaleService,
        private notify: NotificationsService,
        private ngbModalService: NgbModal,
        private elementRef: ElementRef<HTMLElement>,
        platform: PlatformService,
        @Inject(SFTPContextMenuItemProvider) contextMenuProviders: SFTPContextMenuItemProvider[],
    ) {
        super(ngbModalService, notify, platform, contextMenuProviders)
        this.editor = new SftpRemoteEditor(notify, platform)
    }

    ngOnDestroy (): void {
        this.editor.dispose()
    }

    ////// CONTEXT MENUS //////
    /** Create actions, on a right-click over the empty area of the listing. */
    backgroundMenuOpen = false
    /** Columns and display toggles. Opened by right-clicking the header — where SFTP+ puts it, and where one looks for column settings — or from the background menu. */
    displayMenuOpen = false
    backgroundMenuX = 0
    backgroundMenuY = 0
    /** Set when either menu opens, consumed once in ngAfterViewChecked — a menu has no measurable size until Angular has rendered it (piège #30). */
    private backgroundMenuDirty = false

    /**
     * Right-click anywhere in the listing that is not an entry.
     *
     * Entry rows carry their own `(contextmenu)` and this handler sits on
     * their container, so without the guard below a right-click on a file
     * would open both menus. The header is deliberately *not* excluded — it is
     * neither a file nor a folder, and reaching the display settings by
     * right-clicking the column titles is where one would look first.
     */
    onBackgroundContextMenu (event: MouseEvent): void {
        const target = event.target as HTMLElement
        if (target.closest('.sftp-row:not(.sftp-header-row)')) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        // Right-clicking the column titles goes straight to the display
        // settings — one click instead of two, as in SFTP+. Elsewhere in the
        // empty area, the create actions.
        const onHeader = !!target.closest('.sftp-header-row')
        this.selectedPath = null
        this.backgroundMenuX = event.clientX
        this.backgroundMenuY = event.clientY
        this.backgroundMenuOpen = !onHeader
        this.displayMenuOpen = onHeader
        this.backgroundMenuDirty = true
    }

    /**
     * Closes the menu on any click outside it.
     *
     * The `closest()` test is not belt-and-braces: a `document:click`
     * HostListener fires even when a descendant called stopPropagation() on
     * the event, so checking the target explicitly is the only thing that
     * keeps clicking a menu item from dismissing the menu first (piège #15).
     */
    @HostListener('document:click', ['$event'])
    onDocumentClick (event: MouseEvent): void {
        if (!this.backgroundMenuOpen && !this.displayMenuOpen) {
            return
        }
        if ((event.target as HTMLElement).closest('.sftp-floating-menu')) {
            return
        }
        this.backgroundMenuOpen = false
        this.displayMenuOpen = false
    }

    ngAfterViewChecked (): void {
        if (!this.backgroundMenuDirty) {
            return
        }
        this.backgroundMenuDirty = false
        setTimeout(() => {
            const menu = document.querySelector<HTMLElement>('.sftp-floating-menu')
            if (!menu) {
                return
            }
            const { x, y } = clampInViewport(menu, this.backgroundMenuX, this.backgroundMenuY)
            this.backgroundMenuX = x
            this.backgroundMenuY = y
            menu.style.left = `${x}px`
            menu.style.top = `${y}px`
        })
    }

    createDirectoryFromMenu (): void {
        this.backgroundMenuOpen = false
        void this.openCreateDirectoryModal()
    }

    /** Swaps one menu for the other in place, so the display settings appear where the cursor already is. */
    openDisplayMenu (): void {
        this.backgroundMenuOpen = false
        this.displayMenuOpen = true
        this.backgroundMenuDirty = true
    }

    /**
     * Creates an empty remote file.
     *
     * `SFTPSession` offers no "create file", so this goes through `upload()`
     * with a zero-byte transfer — see EmptyFileUpload. Mode 0o644, the usual
     * default for a new file; the context menu on the entry can change it
     * afterwards.
     */
    async createFileFromMenu (): Promise<void> {
        this.backgroundMenuOpen = false
        const modal = this.ngbModalService.open(PromptModalComponent)
        modal.componentInstance.prompt = 'Nom du nouveau fichier'
        const result = await modal.result.catch(() => null)
        const name = result?.value?.trim()
        if (!name) {
            return
        }
        if (name.includes('/')) {
            this.notify.error('Le nom ne peut pas contenir de « / »')
            return
        }

        const fullPath = this.path.endsWith('/') ? `${this.path}${name}` : `${this.path}/${name}`
        try {
            // stat() throwing is how a free name is recognised — there is no
            // exists() on the session, and creating over an existing file
            // would silently truncate it.
            await this.sftp.stat(fullPath)
            this.notify.error(`${name} existe déjà`)
            return
        } catch {
            // Not there: good, carry on.
        }

        try {
            await this.sftp.upload(fullPath, new EmptyFileUpload(name, 0o644))
            await this.navigate(this.path)
        } catch (e) {
            this.notify.error(`Impossible de créer ${name}`, String(e))
        }
    }

    ////// SELECTION & OPENING //////
    select (item: SFTPFile): void {
        this.selectedPath = item.fullPath
    }

    isSelected (item: SFTPFile): boolean {
        return this.selectedPath === item.fullPath
    }

    /**
     * Double-click. Directories navigate, as the inherited `open()` does; files
     * take the edit round-trip instead of `open()`'s save-file dialog.
     */
    async openItem (item: SFTPFile): Promise<void> {
        this.select(item)
        if (item.isDirectory) {
            await this.navigate(item.fullPath)
            return
        }
        if (item.isSymlink) {
            // Resolve first: a symlink to a directory has to navigate, and
            // `item.size`/`item.mode` describe the link, not its target.
            try {
                const target = await this.sftp.readlink(item.fullPath)
                const stat = await this.sftp.stat(target.startsWith('/') ? target : `${this.path}/${target}`)
                if (stat.isDirectory) {
                    await this.navigate(item.fullPath)
                    return
                }
                await this.editor.edit(this.sftp, { ...stat, fullPath: item.fullPath, name: item.name })
                return
            } catch (e) {
                this.notify.error(`Impossible de suivre le lien ${item.name}`, String(e))
                return
            }
        }
        await this.editor.edit(this.sftp, item)
    }

    ////// DELETE //////
    /**
     * Set for the duration of confirm-then-delete, from either trigger below.
     * Without it, holding Delete re-fires `onDocumentKeydown` at keyboard
     * repeat rate while the confirm modal is up (focus lands on one of its
     * *buttons*, not an input, so the input/textarea check doesn't help), and
     * a second click on the context menu entry before the first delete
     * finishes would race two deletions of the same path.
     */
    private deleteInFlight = false

    /**
     * Overridden rather than left inherited: the native `showContextMenu()`
     * (`SFTPPanelComponent`/`CommonSFTPContextMenu`) confirms its "Delete"
     * entry with `platform.showMessageBox()` — a native OS dialog, exactly
     * what this plugin's confirmations are meant never to be (piège #42).
     * `CommonSFTPContextMenu` is the only built-in provider, and always
     * pushes its "Delete" entry last (verified on the installed source), so
     * it is dropped by position unconditionally — the label is only checked
     * to `console.warn` if a future Tabby version ever reorders it, rather
     * than gating the removal on a translation string this plugin doesn't
     * control (the installed app has no French catalog entry for it — it
     * would render in English regardless of this plugin's own locale).
     */
    async showContextMenu (item: SFTPFile, event: MouseEvent): Promise<void> {
        event.preventDefault()
        const items = await this.buildContextMenu(item)
        const last = items.pop()
        if (last && !/^(delete|supprimer)/i.test(String(last.label ?? ''))) {
            console.warn('sidebar-plus: expected the native SFTP context menu to end with "Delete"', last)
        }
        items.push({
            label: 'Supprimer',
            click: () => { void this.confirmAndDelete(item) },
        })
        this.platform.popupContextMenu(items, event)
    }

    /** `Suppr` on the selected entry — same confirm-then-delete path as the context menu entry above. */
    @HostListener('document:keydown', ['$event'])
    onDocumentKeydown (event: KeyboardEvent): void {
        if (event.key !== 'Delete' || event.repeat || !this.selectedPath || this.deleteInFlight) {
            return
        }
        // Guards against firing while this panel is cached-but-detached for a
        // different SSH tab: `SidebarPlusSftpComponent.detachPanel()` calls
        // `.remove()` on the root node rather than merely hiding it (only the
        // currently focused tab's browser is ever attached to `document`), so
        // `offsetParent` is reliably null on every other cached instance.
        if (!this.elementRef.nativeElement.offsetParent) {
            return
        }
        const target = event.target as HTMLElement
        if (target.closest('input, textarea, [contenteditable]')) {
            return
        }
        const item = this.fileList?.find(f => f.fullPath === this.selectedPath)
        if (item) {
            void this.confirmAndDelete(item)
        }
    }

    async confirmAndDelete (item: SFTPFile): Promise<void> {
        if (this.deleteInFlight) {
            return
        }
        this.deleteInFlight = true
        try {
            await this.runDeleteConfirmation(item)
        } finally {
            this.deleteInFlight = false
        }
    }

    private async runDeleteConfirmation (item: SFTPFile): Promise<void> {
        const modal = this.ngbModalService.open(ConfirmModalComponent)
        modal.componentInstance.message = item.isDirectory
            ? `Supprimer le dossier "${item.name}" et tout son contenu ?`
            : `Supprimer "${item.name}" ?`
        modal.componentInstance.confirmLabel = 'Supprimer'
        const confirmed = await modal.result.catch(() => false)
        if (!confirmed) {
            return
        }
        try {
            await this.deleteRecursive(item)
            this.notify.notice(`${item.name} supprimé`)
            this.selectedPath = null
            await this.navigate(this.path)
        } catch (e) {
            this.notify.error(`Impossible de supprimer ${item.name}`, String(e))
        }
    }

    /** Same recursion as the native (non-exported) `SFTPDeleteModalComponent.run()` — no progress UI, single-item selection makes it unnecessary in this pass. */
    private async deleteRecursive (item: SFTPFile): Promise<void> {
        if (item.isDirectory) {
            for (const child of await this.sftp.readdir(item.fullPath)) {
                await this.deleteRecursive(child)
            }
            await this.sftp.rmdir(item.fullPath)
        } else {
            await this.sftp.unlink(item.fullPath)
        }
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

    isToggleOn (key: string): boolean {
        return this.config.store.sidebarPlus?.[key] ?? false
    }

    toggleDisplayOption (key: string): void {
        this.config.store.sidebarPlus[key] = !this.isToggleOn(key)
        this.config.save()
    }

    private displayCache: {
        source: SFTPFile[]
        showHidden: boolean
        foldersFirst: boolean
        result: SFTPFile[]
    }|null = null

    /**
     * What the list actually renders: `filteredFileList` sorted, and with the
     * dotfiles dropped when the user asked for it.
     *
     * A getter rather than a field kept in sync, because `filteredFileList` is
     * rebuilt by the inherited — and private — `updateFilteredList()`, with no
     * hook to piggyback on. Which makes this run on every change detection
     * pass, hence the cache: sorting a large directory several times a second,
     * and handing Angular a new array each time for it to diff, is a cost
     * neither side needs to pay. `updateFilteredList()` always *reassigns*
     * `filteredFileList` rather than mutating it, so reference equality is a
     * sound invalidation signal.
     */
    get displayedFiles (): SFTPFile[] {
        const showHidden = this.isToggleOn('sftpShowHidden')
        const foldersFirst = this.isToggleOn('sftpFoldersFirst')
        const cached = this.displayCache
        if (cached
            && cached.source === this.filteredFileList
            && cached.showHidden === showHidden
            && cached.foldersFirst === foldersFirst) {
            return cached.result
        }

        const files = this.filteredFileList.filter(f => showHidden || !this.isHidden(f))
        files.sort((a, b) => {
            if (foldersFirst && a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1
            }
            // Locale-aware and case-insensitive: readdir returns whatever
            // order the server felt like, which is rarely one a human reads.
            return a.name.localeCompare(b.name, this.locale.getLocale(), { sensitivity: 'base' })
        })

        this.displayCache = { source: this.filteredFileList, showHidden, foldersFirst, result: files }
        return files
    }

    trackByPath (_index: number, item: SFTPFile): string {
        return item.fullPath
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
        return this.fileList !== null && this.displayedFiles.length === 0 && this.hasActiveFilter
    }

    goRoot (): void {
        void this.navigate('/')
    }

    get showColumnBorders (): boolean {
        return this.isToggleOn('sftpColumnBorders')
    }

    get showZebra (): boolean {
        return this.isToggleOn('sftpZebra')
    }
}
