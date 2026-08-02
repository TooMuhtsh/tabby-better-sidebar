import './sftpBrowser.component.scss'
import { filesize } from 'filesize'
import { AfterViewChecked, Component, ElementRef, HostListener, Inject, NgZone, OnDestroy } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, LocaleService, NotificationsService, PlatformService, PromptModalComponent } from 'tabby-core'
import { SFTPContextMenuItemProvider, SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { SidebarPlusEditorService } from '../editorLauncher.service'
import { EmptyFileUpload } from '../sftpLocalTransfer'
import { DirectoryWeight, SftpDragOut } from '../sftpDragOut'
import { OpenMode, SftpRemoteEditor } from '../sftpRemoteEdit'
import { SidebarPlusDragOutServer } from '../dragOutServer.service'
import { SidebarPlusNoticesService } from '../notices.service'
import { readRemoteEntry } from '../remoteEntry'
import { SidebarPlusTempFilesService } from '../tempFiles.service'
import { SftpTransfers } from '../transfers'
import { clampInViewport } from '../viewport'
import { ConfirmModalComponent } from './confirmModal.component'

/** An optional column of the file list. The name column is not one of these — it is always shown. */
/**
 * One rendered row, computed once instead of on every change detection pass.
 *
 * The template used to call a method for the icon, the tooltip and each cell.
 * Angular re-runs those on *every* cycle, and Tabby runs a great many of them —
 * a live terminal alone is enough. On a directory with a few thousand entries
 * that meant thousands of date and size formatting calls per cycle, which is
 * what made a full `/tmp` unusable rather than merely slow.
 */
export interface SftpRow {
    item: SFTPFile
    icon: string
    tooltip: string
    hidden: boolean
    /** Formatted values, positionally aligned with `visibleColumns`. */
    cells: string[]
}

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
    private dragOut: SftpDragOut

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
        zone: NgZone,
        private editors: SidebarPlusEditorService,
        platform: PlatformService,
        temp: SidebarPlusTempFilesService,
        private notices: SidebarPlusNoticesService,
        private dragServer: SidebarPlusDragOutServer,
        @Inject(SFTPContextMenuItemProvider) contextMenuProviders: SFTPContextMenuItemProvider[],
    ) {
        super(ngbModalService, notify, platform, contextMenuProviders)
        const transfers = new SftpTransfers(platform, notices)
        this.editor = new SftpRemoteEditor(notices, editors, transfers, temp, (message, confirmLabel) => this.ask(message, confirmLabel))
        this.dragOut = new SftpDragOut(notices, zone, transfers, temp)
    }

    /**
     * True when the SFTP channel could not be opened at all.
     *
     * Read by the host panel, which has no other way of telling a browser that
     * is merely empty from one that never got a channel.
     */
    sftpUnavailable = false

    /** What the server or the transport actually said — shown rather than guessed at. */
    sftpUnavailableReason = ''

    /**
     * `super.ngOnInit()` calls `session.openSFTP()` **outside** its own
     * try/catch — only the `navigate()` that follows is guarded. So a server
     * without an SFTP subsystem, or a transport that died between the tab
     * opening and the panel being built, rejects here and takes the whole
     * `ngOnInit` down: unhandled rejection, `this.sftp` left undefined, and a
     * panel that shows nothing and says nothing. Catching it is what turns a
     * silent dead view into a state the panel above can act on.
     */
    override async ngOnInit (): Promise<void> {
        try {
            await super.ngOnInit()
        } catch (error) {
            this.sftpUnavailable = true
            this.sftpUnavailableReason = String((error as Error)?.message ?? error)
            return
        }
        this.startAutoRefresh()
        // The interval is rebuilt on every config change rather than tracked:
        // the setting is edited from the settings tab, not from here, and
        // restarting a timer is cheaper than watching one key.
        this.config.changed$.subscribe(() => this.startAutoRefresh())
    }

    ngOnDestroy (): void {
        this.editor.dispose()
        this.dragOut.dispose()
        this.stopAutoRefresh()
    }

    ////// AUTO REFRESH //////
    private autoRefreshTimer: ReturnType<typeof setInterval>|null = null

    /**
     * Reloads the listing on a timer, because nothing else does.
     *
     * SFTP has no change notification: a file created or removed from a shell
     * simply does not appear until the directory is read again. Off by default
     * (0 seconds) — a poll on a large directory is a full `readdir` each time,
     * and the user is the one who knows whether that trade is worth it here.
     *
     * Skipped, never queued, while anything is in the middle of something: a
     * menu open, a path being typed, a delete in flight. Refreshing under an
     * open menu would rebuild the rows beneath it, and the selection with them.
     */
    private startAutoRefresh (): void {
        this.stopAutoRefresh()
        const seconds = Number(this.config.store.sidebarPlus?.sftpAutoRefreshSeconds ?? 0)
        if (!seconds || seconds <= 0) {
            return
        }
        this.autoRefreshTimer = setInterval(() => void this.autoRefresh(), seconds * 1000)
    }

    private stopAutoRefresh (): void {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer)
            this.autoRefreshTimer = null
        }
    }

    private async autoRefresh (): Promise<void> {
        if (!this.sftp || this.deleteInFlight || this.editingPath !== null
            || this.backgroundMenuOpen || this.displayMenuOpen) {
            return
        }
        await this.refreshListing()
    }

    /**
     * Rereads the current directory and merges the result in.
     *
     * Deliberately *not* `navigate()`: that one clears the list before
     * refilling it, so every row is destroyed and rebuilt — the visible jump,
     * and a full re-render of a directory that usually has not changed at all.
     */
    private async refreshListing (): Promise<void> {
        const entries = await this.sftp.readdir(this.path).catch(() => null)
        if (entries) {
            this.applyListing(entries)
        }
    }

    /**
     * Merges a fresh listing into the current one, touching only what differs.
     *
     * Nothing changed ⇒ nothing is reassigned, so `filteredFileList` keeps its
     * identity, the sorted list and the row cache stay valid, and the refresh
     * costs exactly one `readdir` and no rendering whatsoever. When something
     * did change, unchanged entries keep their *existing object*, which is what
     * lets `trackBy` hold on to the rows already on screen — the list updates
     * in place instead of blinking, and the scroll position survives.
     */
    private applyListing (entries: SFTPFile[]): void {
        const current = this.fileList ?? []
        const byPath = new Map(current.map(file => [file.fullPath, file]))
        let changed = current.length !== entries.length
        const merged = entries.map(entry => {
            const existing = byPath.get(entry.fullPath)
            if (existing && this.sameEntry(existing, entry)) {
                return existing
            }
            changed = true
            return entry
        })
        if (!changed) {
            return
        }
        this.fileList = merged
        // The native filter pass, reached through its public trigger rather
        // than through `updateFilteredList()`, which is private.
        this.onFilterChange()
    }

    private sameEntry (a: SFTPFile, b: SFTPFile): boolean {
        return a.size === b.size
            && a.modified.getTime() === b.modified.getTime()
            && a.mode === b.mode
            && a.isDirectory === b.isDirectory
            && a.isSymlink === b.isSymlink
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
     *
     * Always `editor` mode: a double-click must never reach the OS association,
     * which would run an executable rather than open it. `openWith` exists, but
     * only behind the explicit context-menu entry.
     */
    async openItem (item: SFTPFile): Promise<void> {
        await this.openEntry(item, 'editor')
    }

    /**
     * `isDirectory` is not enough on its own.
     *
     * `SFTPSession` fills it from `metadata.type`, a field the SFTP v3 wire
     * format does not carry — servers answer `SSH_FXP_STAT` with a permissions
     * word and nothing else, so a `stat()` on a symlink's target can come back
     * with `isDirectory === false` for a directory. The mode does carry the
     * type (Tabby's own `getModeString()` reads it the same way), so the two
     * are checked together. Without this, a symlink to a directory fell through
     * to the download path and the server answered `Failure` — "Impossible de
     * télécharger <nom>", found in testing on 2026-07-30.
     */
    private static readonly S_IFMT = 0o170000
    private static readonly S_IFDIR = 0o040000

    private isDirectoryEntry (f: SFTPFile): boolean {
        return f.isDirectory || (f.mode & SidebarPlusSftpBrowserComponent.S_IFMT) === SidebarPlusSftpBrowserComponent.S_IFDIR
    }

    private async openEntry (item: SFTPFile, mode: OpenMode): Promise<void> {
        this.select(item)
        if (this.isDirectoryEntry(item)) {
            await this.navigate(item.fullPath)
            return
        }
        if (item.isSymlink) {
            // Resolve first: a symlink to a directory has to navigate, and
            // `item.size`/`item.mode` describe the link, not its target.
            try {
                const target = await this.sftp.readlink(item.fullPath)
                const base = this.path.endsWith('/') ? this.path.slice(0, -1) : this.path
                const stat = await this.sftp.stat(target.startsWith('/') ? target : `${base}/${target}`)
                if (this.isDirectoryEntry(stat)) {
                    await this.navigate(item.fullPath)
                    return
                }
                await this.editor.edit(this.sftp, { ...stat, fullPath: item.fullPath, name: item.name }, mode)
                return
            } catch (e) {
                this.notify.error(`Impossible de suivre le lien ${item.name}`, String(e))
                return
            }
        }
        await this.editor.edit(this.sftp, item, mode)
    }

    ////// DRAG OUT //////
    /**
     * Past either of these, a directory is confirmed before being downloaded.
     * Low on purpose: the cost being guarded against is not disk space but a
     * gesture that appears to do nothing for minutes, with no way to cancel it.
     */
    private static readonly DRAG_OUT_MAX_FILES = 25
    private static readonly DRAG_OUT_MAX_BYTES = 20 * 1024 * 1024

    isDragPreparing (item: SFTPFile): boolean {
        return this.dragOut.isPreparing(item.fullPath)
    }

    /**
     * Native drag towards the OS.
     *
     * `preventDefault()` in every path: the HTML drag is never the one that
     * runs. Either `startDrag()` takes over immediately — the entry is already
     * downloaded — or this gesture only prepares the copy, and the next drag is
     * the one that carries it out. Letting the HTML drag proceed would drag the
     * row's text into whatever accepts it.
     */
    /**
     * True while the mouse button that started a drag gesture is still down.
     *
     * `onDragStart` calls `preventDefault()`, so there is no HTML drag and
     * therefore no `dragend` to listen for — the button state is the only
     * remaining evidence that the user is still holding the gesture.
     */
    private gestureHeld = false

    onDragStart (item: SFTPFile, event: DragEvent): void {
        const isDirectory = this.isDirectoryEntry(item)

        // The real drag-and-drop path: announce the file and let Chromium claim
        // its content when — and only when — the drop lands. `preventDefault()`
        // is deliberately *not* called here, since the browser's own drag is the
        // one doing the work.
        //
        // Files only: a `DownloadURL` announces exactly one file, so a
        // directory still goes through the copy-then-drag route below.
        if (!isDirectory && this.dragServer.ready && event.dataTransfer) {
            const url = this.dragServer.offer(this.sftp, item)
            if (url) {
                event.dataTransfer.effectAllowed = 'copy'
                event.dataTransfer.setData('DownloadURL', `application/octet-stream:${item.name}:${url}`)
                return
            }
        }

        event.preventDefault()
        this.gestureHeld = true
        window.addEventListener('mouseup', () => { this.gestureHeld = false }, { once: true })
        if (isDirectory && !this.config.store.sidebarPlus?.sftpDragOutFolders) {
            this.notices.notice('Le glisser-déposer des dossiers est désactivé — activez-le dans Paramètres → Better Sidebar')
            return
        }
        if (this.dragOut.startDrag(item)) {
            // The copy was current as far as the listing knows; confirm that
            // against the server now that the synchronous part is over.
            void this.dragOut.revalidate(this.sftp, item)
            return
        }
        if (this.dragOut.isPreparing(item.fullPath)) {
            return
        }
        void this.prepareDrag(item, isDirectory)
    }

    private async prepareDrag (item: SFTPFile, isDirectory: boolean): Promise<void> {
        if (isDirectory && !await this.confirmHeavyDirectory(item)) {
            return
        }
        await this.dragOut.prepare(this.sftp, item, isDirectory, () => this.gestureHeld)
    }

    /**
     * Asks before pulling a large directory down, and only then.
     *
     * The count itself stops at the thresholds (see `weigh()`), so a small
     * directory costs one quick walk and no question at all.
     */
    private async confirmHeavyDirectory (item: SFTPFile): Promise<boolean> {
        let weight: DirectoryWeight
        try {
            weight = await this.dragOut.weigh(
                this.sftp,
                item.fullPath,
                SidebarPlusSftpBrowserComponent.DRAG_OUT_MAX_FILES,
                SidebarPlusSftpBrowserComponent.DRAG_OUT_MAX_BYTES,
            )
        } catch (e) {
            this.notify.error(`Impossible de lire le contenu de ${item.name}`, String(e))
            return false
        }
        if (!weight.truncated) {
            return true
        }
        return await this.ask(
            `"${item.name}" contient plus de ${weight.files} fichiers (${filesize(weight.bytes)} au moins). `
            + 'Tout sera téléchargé avant que le glisser-déposer ne devienne possible, sans progression ni annulation. Continuer ?',
            'Télécharger',
        )
    }

    /**
     * The panel's one yes/no question, in HTML rather than a native dialog
     * (piège #42). Handed to the remote editor as a callback so that it can ask
     * about a conflict without knowing anything about modals.
     *
     * Always defaults to Cancel: every caller asks before something
     * irreversible — overwriting a remote file, discarding local edits, pulling
     * a large tree — and a reflex `Entrée` must never be the destructive answer.
     */
    private async ask (message: string, confirmLabel: string): Promise<boolean> {
        const modal = this.ngbModalService.open(ConfirmModalComponent)
        modal.componentInstance.message = message
        modal.componentInstance.confirmLabel = confirmLabel
        modal.componentInstance.defaultButton = 'cancel'
        return await modal.result.catch(() => false)
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
        // Pushed after the pop() above, never before: the native "Delete" entry
        // is dropped by position, so inserting anything first would remove the
        // wrong item. The one route to the OS association, and only from here —
        // a double-click can never reach it. Windows-only: `OpenAs_RunDLL` has
        // no equivalent elsewhere, and this plugin is published publicly.
        if (!this.isDirectoryEntry(item) && this.editors.canOpenWith) {
            items.push({
                label: 'Ouvrir avec...',
                click: () => { void this.openEntry(item, 'openWith') },
            })
        }
        items.push({
            label: 'Renommer...',
            click: () => { void this.renameEntry(item) },
        })
        items.push({
            label: 'Supprimer',
            click: () => { void this.confirmAndDelete(item) },
        })
        this.platform.popupContextMenu(items, event)
    }

    /**
     * Clicking the empty area below the rows clears the selection.
     *
     * The listing has no separate background element — the empty space is the
     * body's own padding — so this fires for row clicks as well and has to
     * ignore them. `closest('.sftp-row')` rather than a target equality test:
     * a click lands on the icon or the label inside a row, never on the row
     * element itself.
     */
    clearSelectionFromBackground (event: MouseEvent): void {
        // `.sftp-row` covers the header row and the "go up" row too, both of
        // which carry that class — clicking either must not clear a selection
        // the user made on purpose.
        if ((event.target as HTMLElement).closest('.sftp-row')) {
            return
        }
        this.selectedPath = null
    }

    /**
     * Renames a remote entry, extension included.
     *
     * The field is prefilled with the **whole** name rather than the stem: the
     * user asked to be able to change the extension, so it has to be there to
     * be edited. Nothing warns about changing it either — on a remote server
     * that is a deliberate act, not a slip.
     *
     * Only a rename, never a move: a `/` is refused rather than quietly
     * relocating the entry somewhere else. `rename()` would accept a path
     * happily, which is exactly why it is worth blocking here.
     */
    private async renameEntry (item: SFTPFile): Promise<void> {
        const modal = this.ngbModalService.open(PromptModalComponent)
        modal.componentInstance.prompt = `Nouveau nom de « ${item.name} »`
        modal.componentInstance.value = item.name
        const result = await modal.result.catch(() => null)
        const name = result?.value?.trim()
        if (!name || name === item.name) {
            return
        }
        if (name.includes('/')) {
            this.notices.error('Le nom ne peut pas contenir de « / » — ceci renomme, cela ne déplace pas')
            return
        }

        const target = this.path.endsWith('/') ? `${this.path}${name}` : `${this.path}/${name}`
        // Checked rather than left to the server: SFTP v3 lets an
        // implementation decide what a rename onto an existing name does, and
        // some overwrite it. Refusing outright is the only answer that cannot
        // destroy something.
        if (await readRemoteEntry(this.sftp, target)) {
            this.notices.error(`${name} existe déjà dans ce dossier`)
            return
        }

        try {
            await this.sftp.rename(item.fullPath, target)
        } catch (e) {
            this.notices.error(`Impossible de renommer ${item.name}`, String(e))
            return
        }

        // The selection follows the entry rather than being dropped: the file
        // the user was working on is still the one they are working on.
        if (this.selectedPath === item.fullPath) {
            this.selectedPath = target
        }
        await this.refreshListing()
        this.notices.notice(`${item.name} renommé en ${name}`)
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
        // Which button `Entrée` hits, from the settings tab. Applied to both
        // triggers, not just the `Suppr` key that prompted the request: the
        // same modal answering the same question differently depending on how
        // it was opened would be a trap, not a feature.
        modal.componentInstance.defaultButton = this.config.store.sidebarPlus?.sftpDeleteDefaultButton ?? 'cancel'
        const confirmed = await modal.result.catch(() => false)
        if (!confirmed) {
            return
        }
        try {
            await this.deleteRecursive(item)
            this.notices.notice(`${item.name} supprimé`)
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
    private columnCache: { key: string, result: SftpColumn[] }|null = null

    /**
     * Cached for its *identity*, not to save the filter.
     *
     * This getter feeds an `*ngFor` inside every row and the grid template of
     * every row. Returning a fresh array each time made Angular re-diff the
     * columns of each row on every cycle — the single biggest cost on a large
     * directory. The config's own column list is the invalidation key.
     */
    get visibleColumns (): SftpColumn[] {
        const selected: string[] = this.config.store.sidebarPlus?.sftpColumns ?? []
        const key = selected.join(' ')
        if (this.columnCache?.key === key) {
            return this.columnCache.result
        }
        const result = this.availableColumns.filter(c => selected.includes(c.id))
        this.columnCache = { key, result }
        return result
    }

    /**
     * Both the header and every row carry this, rather than the grid being
     * declared once on the container with rows as `display: contents` — a row
     * that generates no box cannot take a hover background or a bottom border.
     */
    get gridTemplate (): string {
        const columns = this.visibleColumns
        if (this.gridCache?.columns === columns) {
            return this.gridCache.result
        }
        const result = ['1.15rem', 'minmax(0, 1fr)', ...columns.map(c => c.width)].join(' ')
        this.gridCache = { columns, result }
        return result
    }

    private gridCache: { columns: SftpColumn[], result: string }|null = null

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

    trackByRow (_index: number, row: SftpRow): string {
        return row.item.fullPath
    }

    private rowCache: { source: SFTPFile[], columns: SftpColumn[], result: SftpRow[] }|null = null

    /**
     * The rows as the template consumes them: everything formatted up front.
     *
     * Recomputed only when the sorted list or the visible columns change, both
     * of which are compared by reference — `displayedFiles` and
     * `visibleColumns` each hand back a stable array until something real
     * changes. `isSelected()` and `isDragPreparing()` stay as calls in the
     * template on purpose: they are a `Set`/`Map` lookup, and they change
     * without the list changing at all.
     */
    get rows (): SftpRow[] {
        const source = this.displayedFiles
        const columns = this.visibleColumns
        const cached = this.rowCache
        if (cached && cached.source === source && cached.columns === columns) {
            return cached.result
        }
        // Rows whose entry object survived the merge are reused as they are:
        // after a refresh where one file changed, only that file is formatted
        // again. `applyListing()` is what makes this work — it keeps the
        // existing object for every unchanged entry.
        const previous = new Map((cached?.columns === columns ? cached.result : []).map(row => [row.item, row]))
        const result = source.map(item => previous.get(item) ?? {
            item,
            icon: this.getIcon(item),
            tooltip: this.rowTooltip(item),
            hidden: this.isHidden(item),
            cells: columns.map(column => this.cellValue(column, item)),
        })
        this.rowCache = { source, columns, result }
        return result
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
