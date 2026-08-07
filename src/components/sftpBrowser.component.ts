import './sftpBrowser.component.scss'
import { posix } from 'path'
import { filesize } from 'filesize'
import { AfterViewChecked, Component, ElementRef, HostListener, Inject, NgZone, OnDestroy } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, HTMLFileUpload, LocaleService, NotificationsService, PlatformService, PromptModalComponent } from 'tabby-core'
import { SFTPContextMenuItemProvider, SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { SidebarPlusEditorService } from '../editorLauncher.service'
import { electronRemote } from '../electronRemote'
import { EmptyFileUpload } from '../sftpLocalTransfer'
import { DirectoryWeight, SftpDragOut } from '../sftpDragOut'
import { OpenMode, SftpRemoteEditor } from '../sftpRemoteEdit'
import { SidebarPlusDragOutServer } from '../dragOutServer.service'
import { freeLocalName } from '../localNames'
import { SidebarPlusNoticesService } from '../notices.service'
import { readRemoteEntry, resolveRemoteSymlink } from '../remoteEntry'
import { downloadRemoteTree } from '../remoteTree'
import { SidebarPlusTempFilesService } from '../tempFiles.service'
import { SftpTransfers } from '../transfers'
import { SidebarPlusTransfersService } from '../transfersRegistry.service'
import { clampInViewport } from '../viewport'
import { ConfirmModalComponent } from './confirmModal.component'

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

/**
 * One file of a drop, and the remote path it is headed for.
 *
 * Resolved up front, before anything is written: the collision check needs the
 * whole list, and the confirmation it may raise has to happen before the first
 * byte leaves. The `File` is only a handle — the transfer that reads it is
 * built when its turn comes, not here.
 */
interface PlannedUpload {
    file: File
    remotePath: string
}

/**
 * What a row puts on the clipboard when it is dragged inside the panel.
 *
 * A type of our own is what tells an internal move from files coming in from
 * the OS — never the cursor's position, which says nothing about what is being
 * carried. Chromium hands custom types back verbatim within the same window,
 * and ignores them everywhere else, so the same gesture can announce this *and*
 * a `DownloadURL` for the OS without either reading the other's.
 *
 * Its value is the entry's full remote path. Read at the drop and compared to
 * the source the panel remembers: `getData()` answers an empty string during
 * `dragover` (only `types` is readable there), so the live field is what the
 * highlight is computed from, and this is what confirms it at the end.
 */
const INTERNAL_DRAG_TYPE = 'application/x-tabby-sftp-path'

/** A whole drop, flattened: the directories to create, then the files to send. */
interface DropPlan {
    /** Parents before children — `planFromEntries()` walks the tree depth-first, so the order is already right. */
    directories: string[]
    files: PlannedUpload[]
}

/**
 * Reads a dropped directory **whole**.
 *
 * `readEntries()` answers with a slice, not a listing — 100 entries at a time
 * in Chromium — and the only end-of-listing signal the API gives is an empty
 * answer. So it has to be called until it returns nothing.
 *
 * This is why the drop no longer goes through
 * `PlatformService.startUploadFromDragEvent()`, which the roadmap had planned
 * on: it calls `readEntries()` exactly once per directory. Everything past the
 * first slice is dropped with no error and no trace, and the recap that follows
 * counts only what it saw — a folder of 250 files uploads 150 fewer than it
 * says.
 */
function readAllEntries (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    return new Promise((resolve, reject) => {
        const all: FileSystemEntry[] = []
        const step = (): void => reader.readEntries(batch => {
            if (!batch.length) {
                resolve(all)
                return
            }
            all.push(...batch)
            step()
        }, reject)
        step()
    })
}

/** The callback-style `FileSystemFileEntry.file()`, awaited. */
function entryFile (entry: FileSystemFileEntry): Promise<File> {
    return new Promise((resolve, reject) => entry.file(resolve, reject))
}

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

    /** Full path of the selected entry, or null. Single selection only — there is no bulk action to justify more. */
    selectedPath: string|null = null

    private editor: SftpRemoteEditor
    private dragOut: SftpDragOut

    // Declared explicitly rather than relying on Angular inheriting the
    // parent's factory: the parameters are the contract with SSHModule's
    // providers, and spelling them out keeps a future change in tabby-ssh a
    // compile error instead of a runtime injection failure.
    //
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
        private zone: NgZone,
        private editors: SidebarPlusEditorService,
        platform: PlatformService,
        temp: SidebarPlusTempFilesService,
        private notices: SidebarPlusNoticesService,
        private dragServer: SidebarPlusDragOutServer,
        private registry: SidebarPlusTransfersService,
        @Inject(SFTPContextMenuItemProvider) contextMenuProviders: SFTPContextMenuItemProvider[],
    ) {
        super(ngbModalService, notify, platform, contextMenuProviders)
        const transfers = new SftpTransfers(platform, notices, registry)
        this.fileTransfers = transfers
        this.platformSvc = platform
        this.editor = new SftpRemoteEditor(notices, editors, transfers, temp, (message, confirmLabel) => this.ask(message, confirmLabel), zone)
        this.dragOut = new SftpDragOut(notices, zone, transfers, temp)
    }

    /** The transfers helper shared with the editor and the drag-out — kept for routes started here. */
    private readonly fileTransfers: SftpTransfers
    /** The constructor's `platform` goes to `super` — kept under our own name for the routes below. */
    private readonly platformSvc: PlatformService

    private _sessionLabel: string|null = null
    /**
     * Display name of the SSH tab this panel serves, set by the host panel at
     * creation. Forwarded to the transfers helper, which stamps it on every
     * registry line this panel starts — and passed along with each drag-out
     * offer, whose delivery happens long after this component may be gone.
     */
    set sessionLabel (value: string|null) {
        this._sessionLabel = value
        this.fileTransfers.sessionLabel = value
    }

    get sessionLabel (): string|null {
        return this._sessionLabel
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
        this.clearDropTarget()
        // The one listener this component puts on `document` — a panel torn
        // down mid-gesture would otherwise leave it there for good.
        this.stopWatchingWindowExit()
    }

    /**
     * Serves the file ourselves and lets Chromium write it, instead of the
     * inherited `platform.startDownload()` path.
     *
     * The inherited one calls `this.sftp.download(...)` **without awaiting
     * it** (`sftpPanel.component.ts:252` of the installed app), so a transport
     * that dies mid-transfer rejects a promise nobody holds: the failure never
     * reaches us, and all the panel sees is the `transfer.cancel()` tabby-ssh
     * makes on its way out — a line reading "annulé" for something the user
     * never cancelled. Going through our own HTTP offer puts the rejection back
     * in a catch we own, which is what tells a dead transfer apart from a
     * cancelled one.
     *
     * **Overriding `download()` and not `downloadItem()` is the point.** This
     * used to hook the latter, which left the whole thing resting on an
     * unwritten assumption: that the context menu entry calls
     * `panel.downloadItem(item)` (it does, in `sftpContextMenu.ts`). If Tabby
     * ever pointed that entry at `download()` instead, the override would have
     * stopped being reached — no error, no sign, just the "annulé" label
     * quietly back. `download()` is where both routes end up, `open()`
     * included, so which one the host picks stops mattering. That is one
     * unverifiable assumption removed rather than watched.
     *
     * Chromium does the writing, so what is given up is the native transfers
     * menu's progress bar — a trade the user made knowingly on 2026-08-02, this
     * plugin hiding that menu by default and its own panel saying more
     * (percentage, speed, ETA).
     *
     * Directories and symlinks stay on the inherited path, as before: a
     * `DownloadURL` offer serves exactly one file, and a link is only ever
     * resolved through the `stat()` piège #50 warns against — its `size` is
     * sound but its mode is not, and there is nothing here worth that risk.
     * `downloadFolder()` never comes through here at all.
     */
    override async download (itemPath: string, mode: number, size: number): Promise<void> {
        // The listing, never `stat()` (piège #50): it comes from `readdir`, so
        // its size and mode are the real ones. An entry that is not in it —
        // nothing reaches this method today with such a path — falls back.
        const item = this.fileList?.find(f => f.fullPath === itemPath)
        if (!item || item.isDirectory || item.isSymlink || !this.dragServer.ready || this.downloadsAreIntercepted()) {
            await super.download(itemPath, mode, size)
            return
        }
        const url = this.dragServer.offer(this.sftp, item, this._sessionLabel ?? undefined)
        if (!url) {
            await super.download(itemPath, mode, size)
            return
        }
        // A detached anchor is enough — the offer answers with
        // `Content-Disposition: attachment`, so Chromium downloads rather than
        // navigates, and the transfer registers itself when the request lands.
        const link = document.createElement('a')
        link.href = url
        link.download = item.name
        link.click()
    }

    /**
     * Sends « Download directory » down this plugin's own route instead of the
     * inherited one.
     *
     * The inherited route *does* await its transfers, but converts any failure
     * into `transfer.cancel()` on its single aggregated line — so a transport
     * that dies mid-download reads « annulé » for something the user never
     * cancelled, exactly the confusion `download()` above was moved off of.
     * Going through `SftpTransfers.download()` gives every file its own line,
     * a real `failed` state when one dies, and the arrival check — the folder
     * route is the one place where the destination is a path we chose, so
     * « le fichier est-il bien arrivé ? » is actually answerable here.
     *
     * Same shape as the marker delivery in `SidebarPlusDragOutServer.deliver()`:
     * pick a folder, avoid collisions the Explorer way, then walk and fetch
     * four files at a time. The directory dialog is ours to raise since the
     * inherited `startDownloadDirectory()` is never called — `pickDirectory()`
     * answers null on cancel, which ends the gesture without a word, like the
     * native route.
     */
    override async downloadFolder (folder: SFTPFile): Promise<void> {
        // Arity-checked like `imposesPath`: an older Tabby without the two
        // dialog arguments still answers a folder, just with a stock title.
        if (typeof this.platformSvc.pickDirectory !== 'function') {
            await super.downloadFolder(folder)
            return
        }
        const base = await this.platformSvc.pickDirectory(
            `Dossier de destination pour ${folder.name}`,
            'Télécharger ici',
        )
        if (!base) {
            return
        }
        const target = freeLocalName(base, folder.name)
        try {
            await downloadRemoteTree(
                this.sftp, folder.fullPath, target,
                (remote, local, item) => this.fileTransfers.download(this.sftp, remote, local, item.name, item.size, item.mode),
            )
            this.notices.notice(`${folder.name} téléchargé dans ${base}`)
        } catch (error) {
            // The lines already say which file failed and why; the toast says
            // the folder as a whole is not to be trusted yet.
            this.notices.error(
                `${folder.name} : téléchargement incomplet`,
                String((error as Error)?.message ?? error),
            )
        }
    }

    /**
     * Whether something now decides where downloads land.
     *
     * The second thing our route rests on: Tabby installs **no**
     * `will-download` handler, which is what leaves Electron free to raise its
     * own "Save as" dialog — the same prompt the inherited path used to raise.
     * A handler appearing there would silently change what the user gets, and
     * could cancel the download outright, which would be a click that does
     * nothing at all.
     *
     * Rather than document that as a thing to re-check after a Tabby update,
     * it is asked. `listenerCount` is an EventEmitter method, i.e. actually
     * contractual, unlike everything else in this file's neighbourhood.
     * Measured at 0 on the installed app. When it is not, the inherited route
     * is the honest answer: `platform.startDownload()` is what Tabby would
     * expect to be handling.
     */
    private downloadsAreIntercepted (): boolean {
        try {
            return (electronRemote()?.session?.defaultSession?.listenerCount('will-download') ?? 0) > 0
        } catch {
            // Unreachable remote is not evidence of interception, and this is a
            // fallback, not a gate: keep the route that works.
            return false
        }
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
        // There is no `exists()` on the session, and creating over an existing
        // file would silently truncate it. Read through the parent's listing
        // rather than through `stat()`: same answer for an ordinary file, but
        // `stat()` follows links, so a *dangling* symlink of that name reported
        // the name as free — and the create then clobbered the link. Same check
        // as `renameEntry()` makes, by the same route.
        if (await readRemoteEntry(this.sftp, fullPath)) {
            this.notify.error(`${name} existe déjà`)
            return
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

    /** A symlink chain longer than this is a loop as far as we are concerned. */
    /**
     * Follows a symlink to the entry it really designates — the shared
     * resolver in remoteEntry.ts, kept behind a method so the many call sites
     * of this file did not all have to change when it moved there.
     */
    private async resolveSymlink (item: SFTPFile): Promise<SFTPFile|null> {
        return resolveRemoteSymlink(this.sftp, item)
    }

    /**
     * Opens an entry: directories navigate, files take the edit round-trip.
     *
     * A symlink is resolved to its target **and the target is what gets
     * edited** — path included. Keeping the link's own path here is what used
     * to make three things go wrong at once, none of them visible at the time:
     * the mode read for the download came from `stat()` and was 0, so the local
     * copy was created read-only and the editor could not save; the mode
     * restored after an upload was the *link's* (`0o120777`), so the file came
     * back world-writable; and the freshness check compared the link's size and
     * date, which never move when the target changes, so conflict detection was
     * dead. Writing to the resolved path settles all three, and has a fourth
     * effect worth stating: `SFTPSession.upload()` unlinks its target before
     * renaming over it, so editing "through" the link used to replace it with a
     * regular file. It no longer touches the link at all.
     */
    private async openEntry (item: SFTPFile, mode: OpenMode): Promise<void> {
        this.select(item)
        if (this.isDirectoryEntry(item)) {
            await this.navigate(item.fullPath)
            return
        }
        if (item.isSymlink) {
            let target: SFTPFile|null
            try {
                target = await this.resolveSymlink(item)
            } catch (e) {
                this.notify.error(`Impossible de suivre le lien ${item.name}`, String(e))
                return
            }
            if (!target) {
                this.notices.error(`${item.name} pointe vers une cible introuvable`)
                return
            }
            if (this.isDirectoryEntry(target)) {
                // Navigation stays on the link's own path: that is the location
                // the user asked for, and the server resolves it on its own.
                await this.navigate(item.fullPath)
                return
            }
            // Said out loud when the names differ: the editor is about to open
            // something else than the row that was double-clicked.
            if (target.name !== item.name) {
                this.notices.notice(`${item.name} → ${target.fullPath}`)
            }
            await this.editor.edit(this.sftp, target, mode)
            return
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

    /** Whether a directory may leave for the OS at all. Off by default; files are always draggable. */
    private get canDragOutFolders (): boolean {
        return !!this.config.store.sidebarPlus?.sftpDragOutFolders
    }

    onDragStart (item: SFTPFile, event: DragEvent): void {
        const isDirectory = this.isDirectoryEntry(item)

        // A directory that asked to leave on the previous gesture. The copy to
        // the OS takes the *whole* gesture — see `dragOutIntent` — so nothing
        // else is set up here.
        if (isDirectory && this.claimDragOutIntent(item)) {
            event.preventDefault()
            this.copyToOS(item, true)
            return
        }

        // Announced first, and on every gesture that keeps its HTML drag: this
        // is what makes an internal move possible, and it costs nothing when
        // the drop lands outside — Chromium hands custom types to the source
        // window only.
        event.dataTransfer?.setData(INTERNAL_DRAG_TYPE, item.fullPath)
        this.internalDragSource = item

        // The real drag-and-drop path: announce the file and let Chromium claim
        // its content when — and only when — the drop lands. `preventDefault()`
        // is deliberately *not* called here, since the browser's own drag is the
        // one doing the work.
        //
        // Files only: a `DownloadURL` announces exactly one file, so a
        // directory cannot be offered this way and takes the route below.
        if (!isDirectory && this.dragServer.ready && event.dataTransfer) {
            const url = this.dragServer.offer(this.sftp, item, this._sessionLabel ?? undefined)
            if (url) {
                // Both, because both are on offer: copy towards the OS, move
                // inside the panel. `effectAllowed` is the gate `dropEffect`
                // has to fit through — leaving it at `copy` would have the
                // engine veto the move rather than merely mislabel it.
                event.dataTransfer.effectAllowed = 'copyMove'
                event.dataTransfer.setData('DownloadURL', `application/octet-stream:${item.name}:${url}`)
                return
            }
        }

        // A directory leaves through a *marker*: an empty file under a unique
        // name, announced in its place. The shell writes it at the drop site,
        // which is what reveals where the drop landed — and the entry is then
        // delivered there by us (see `SidebarPlusDragOutServer.serveMarker`).
        //
        // What this buys over `startDrag()`, beyond knowing the destination: the
        // gesture stays a plain HTML drag, so the internal move keeps working on
        // the same drag and the copy no longer takes a gesture of its own. The
        // two-step shape below is only reached when the server never started.
        if (isDirectory && this.canDragOutFolders && this.dragServer.ready && event.dataTransfer) {
            const marker = this.dragServer.offerMarker(this.sftp, item, this._sessionLabel ?? undefined)
            if (marker) {
                event.dataTransfer.effectAllowed = 'copyMove'
                event.dataTransfer.setData('DownloadURL', `application/octet-stream:${marker.markerName}:${marker.url}`)
                return
            }
        }

        // A directory keeps its HTML drag: this gesture is the move's, and
        // `preventDefault()` would take that away. Leaving the window without
        // dropping is what asks for the copy instead, and the *next* gesture is
        // the one that carries it out.
        if (isDirectory) {
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move'
            }
            this.watchForWindowExit(item)
            return
        }

        // A file with no HTTP offer to announce — the drag-out server failed to
        // start. Falls back to the local copy, which needs the whole gesture.
        event.preventDefault()
        // No HTML drag from here on, so there is no internal move to be had
        // either — and no `dragend` coming to clear this.
        this.internalDragSource = null
        this.copyToOS(item, false)
    }

    /**
     * The copy-to-OS route: hand over the local copy if there is one, otherwise
     * take it and say so.
     */
    private copyToOS (item: SFTPFile, isDirectory: boolean): void {
        this.gestureHeld = true
        window.addEventListener('mouseup', () => { this.gestureHeld = false }, { once: true })
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

    private async prepareDrag (item: SFTPFile, isDirectory: boolean): Promise<boolean> {
        if (isDirectory && !await this.confirmHeavyDirectory(item)) {
            return false
        }
        await this.dragOut.prepare(this.sftp, item, isDirectory, () => this.gestureHeld)
        return true
    }

    ////// A DIRECTORY ASKING TO LEAVE //////
    /**
     * Full path of the directory whose *next* drag goes to the OS.
     *
     * One gesture cannot serve both purposes. Moving a row needs the HTML drag
     * to run; copying a directory out needs `preventDefault()` and Electron's
     * `startDrag()`, which only accepts a path that already exists on disk — so
     * the two are mutually exclusive, and a file only escapes the choice because
     * a `DownloadURL` rides along with the HTML drag.
     *
     * The gesture is therefore split in two, which is what the copy already did
     * anyway ("prepare, then drag again"): dragging a directory out of the
     * window without dropping it states the intent and starts the download, and
     * the gesture after that is the one that carries it away. Dragging it inside
     * the panel moves it, always.
     */
    private dragOutIntent: string|null = null

    /** True once, for the directory that asked. Cleared as it is served, so the gesture after is a move again. */
    private claimDragOutIntent (item: SFTPFile): boolean {
        if (this.dragOutIntent !== item.fullPath) {
            return false
        }
        this.dragOutIntent = null
        return true
    }

    /**
     * Past this long without a `dragover` anywhere in the window, the pointer is
     * taken to be outside it.
     *
     * `dragover` fires at mouse-move rate while the cursor is over the document,
     * and stops the moment it leaves — so the age of the last one is what tells
     * "dropped on the desktop" from "let go inside Tabby". Preferred over
     * counting `dragenter`/`dragleave` pairs, which Chromium already reports
     * unreliably here (see `onDragLeave`).
     */
    private static readonly WINDOW_EXIT_MS = 150

    private windowExitCandidate: SFTPFile|null = null
    private lastPointerInWindow = 0
    private windowExitWatcher: (() => void)|null = null

    private watchForWindowExit (item: SFTPFile): void {
        this.stopWatchingWindowExit()
        this.windowExitCandidate = item
        this.lastPointerInWindow = Date.now()
        this.windowExitWatcher = () => { this.lastPointerInWindow = Date.now() }
        // Capture phase, on the document: this has to see every `dragover` of
        // the window, including those a handler further down stops.
        document.addEventListener('dragover', this.windowExitWatcher, true)
    }

    private stopWatchingWindowExit (): void {
        if (this.windowExitWatcher) {
            document.removeEventListener('dragover', this.windowExitWatcher, true)
            this.windowExitWatcher = null
        }
        this.windowExitCandidate = null
    }

    /**
     * Whether the gesture that just ended was aimed out of the window.
     *
     * Both halves matter: a drop the panel accepted ends with its own
     * `dropEffect`, and a gesture let go anywhere inside Tabby has a fresh
     * `dragover` behind it.
     */
    private wasAimedOutOfWindow (event: DragEvent|undefined): boolean {
        return event?.dataTransfer?.dropEffect === 'none'
            && Date.now() - this.lastPointerInWindow > SidebarPlusSftpBrowserComponent.WINDOW_EXIT_MS
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

    ////// WHERE A DROP LANDS — SHARED BY BOTH KINDS //////
    /**
     * Where a drop would land, while one is being dragged over the list. Null
     * when nothing is. The row bearing that path is the one highlighted; when
     * it is the current directory, the body is outlined instead.
     */
    dropTargetPath: string|null = null

    /** Set when the `..` row is the target — the one destination that is not a row of the listing. */
    dropOnUpRow = false

    isDropTarget (item: SFTPFile): boolean {
        return !this.dropOnUpRow && this.dropTargetPath === item.fullPath
    }

    get dropInCurrentDirectory (): boolean {
        return !this.dropOnUpRow && this.dropTargetPath === this.path
    }

    /**
     * Whether this drag is files coming in from the OS.
     *
     * A drag *out* of this panel announces itself as `DownloadURL`, and
     * Chromium reports it over the source window too — without this it would be
     * read as an incoming drop and the file uploaded back on top of itself.
     */
    private carriesFiles (event: DragEvent): boolean {
        const types = event.dataTransfer?.types
        return !!types && types.includes('Files') && !types.includes('DownloadURL')
    }

    /**
     * Whether this drag is a row of this very panel, on its way to another
     * directory.
     *
     * Asked *before* `carriesFiles()` by both handlers below: a file dragged
     * from here announces `DownloadURL` — and therefore `Files` — as well, so
     * the two questions overlap and only the order settles which one answers.
     */
    private carriesInternalPath (event: DragEvent): boolean {
        return !!event.dataTransfer?.types.includes(INTERNAL_DRAG_TYPE)
    }

    /**
     * Where a drop over this element would land.
     *
     * Deliberately synchronous — it runs on every `dragover`, which fires
     * continuously while the cursor moves. A symlink is therefore answered as
     * itself and only resolved at the drop: telling a link to a directory from
     * a link to a file costs a `readlink` round trip, which has no place here.
     *
     * Anything that is not a directory row — a file, the header, the empty area
     * below the list — answers null, meaning the current directory. That is the
     * guard the roadmap asked for: a drop can never land somewhere the user did
     * not aim at, only in the directory already on screen.
     */
    private aimFrom (target: HTMLElement): SFTPFile|'up'|null {
        const row = target.closest('.sftp-row')
        if (!row || row.classList.contains('sftp-header-row')) {
            return null
        }
        if (row.classList.contains('sftp-row-up')) {
            return 'up'
        }
        const itemPath = (row as HTMLElement).dataset.path
        const item = itemPath ? this.displayedFiles.find(file => file.fullPath === itemPath) : null
        if (!item || !(this.isDirectoryEntry(item) || item.isSymlink)) {
            return null
        }
        return item
    }

    onDragOver (event: DragEvent): void {
        if (!this.sftp) {
            return
        }
        const internal = this.carriesInternalPath(event)
        if (!internal && !this.carriesFiles(event)) {
            return
        }
        const aimed = this.aimFrom(event.target as HTMLElement)
        // A move that cannot happen shows nothing and accepts nothing: without
        // `preventDefault()` the drop never fires, which is exactly the answer
        // for a directory aimed at itself or a row already where it would land.
        if (internal && !this.canMoveTo(aimed)) {
            this.clearDropTarget()
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'none'
            }
            return
        }
        // Without this the drop event never fires, and the cursor keeps
        // Chromium's default "move" glyph for something that copies.
        event.preventDefault()
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = internal ? 'move' : 'copy'
        }
        if (this.dropClearTimer) {
            clearTimeout(this.dropClearTimer)
            this.dropClearTimer = null
        }
        this.dropOnUpRow = aimed === 'up'
        this.dropTargetPath = aimed === 'up'
            ? posix.dirname(this.path)
            : aimed?.fullPath ?? this.path
    }

    /**
     * Long enough to outlive a spurious `dragleave`, short enough not to leave a
     * highlight behind. `dragover` fires at mouse-move rate while the pointer is
     * inside, so any delay above a frame or two bridges the gap.
     */
    private static readonly DROP_CLEAR_MS = 120

    private dropClearTimer: ReturnType<typeof setTimeout>|null = null

    /**
     * `dragleave` fires on every crossing between children, so the only useful
     * question is whether the cursor left the panel altogether.
     *
     * The answer is not always reliable: Chromium reports a null
     * `relatedTarget` on some crossings, which reads as "left the panel" for a
     * pointer that never went anywhere. Hence the delay — a `dragover` still to
     * come cancels it, and the highlight stops flickering under a moving cursor.
     */
    onDragLeave (event: DragEvent): void {
        const to = event.relatedTarget as Node|null
        if (to && (event.currentTarget as HTMLElement).contains(to)) {
            return
        }
        if (this.dropClearTimer) {
            clearTimeout(this.dropClearTimer)
        }
        this.dropClearTimer = setTimeout(
            () => this.clearDropTarget(),
            SidebarPlusSftpBrowserComponent.DROP_CLEAR_MS,
        )
    }

    private clearDropTarget (): void {
        if (this.dropClearTimer) {
            clearTimeout(this.dropClearTimer)
            this.dropClearTimer = null
        }
        this.dropTargetPath = null
        this.dropOnUpRow = false
    }

    onDrop (event: DragEvent): void {
        if (!this.sftp) {
            return
        }
        const internal = this.carriesInternalPath(event)
        if (!internal && !this.carriesFiles(event)) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        const aimed = this.aimFrom(event.target as HTMLElement)
        const source = this.internalDragSource
        this.clearDropTarget()
        if (internal) {
            // Read while the event is still being dispatched — `getData()`
            // answers nothing once the handler has returned.
            void this.receiveMove(source, event.dataTransfer?.getData(INTERNAL_DRAG_TYPE) ?? '', aimed)
            return
        }
        void this.receiveDrop(this.claimEntries(event), aimed)
    }

    ////// DROP FROM THE OS //////
    /**
     * Takes hold of what was dropped, synchronously.
     *
     * `dataTransfer.items` is only readable while the event is being
     * dispatched — `webkitGetAsEntry()` answers null once the handler has
     * returned — so the entries have to be claimed here, before the first
     * await. The entries themselves stay valid afterwards; the item list does
     * not.
     */
    private claimEntries (event: DragEvent): FileSystemEntry[] {
        const items = event.dataTransfer?.items
        if (!items) {
            return []
        }
        const entries: FileSystemEntry[] = []
        for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry()
            if (entry) {
                entries.push(entry)
            }
        }
        return entries
    }

    private async receiveDrop (entries: FileSystemEntry[], aimed: SFTPFile|'up'|null): Promise<void> {
        if (!entries.length) {
            return
        }
        // Everything below resumes from `readEntries`/`file()` callbacks, which
        // zone.js does not patch: it mutates state and may open a modal, and
        // would otherwise not be painted until something else triggered a cycle
        // (piège #41).
        await this.zone.run(async () => {
            const destination = await this.resolveDestination(aimed)
            let plan: DropPlan
            try {
                plan = await this.planFromEntries(entries, destination)
            } catch (e) {
                this.notices.error('Impossible de lire ce qui a été déposé', String(e))
                return
            }
            if (!plan.files.length && !plan.directories.length) {
                return
            }
            const collisions = await this.findCollisions(plan.files)
            // Nothing has been written at this point — not even a directory —
            // so turning the question down leaves the server exactly as it was.
            if (collisions.length && !await this.confirmOverwrite(collisions, destination)) {
                return
            }
            const failed = await this.runPlan(plan)
            this.reportDrop(plan, failed, destination)
            await this.refreshListing()
        })
    }

    /**
     * Turns the aimed row into the directory the files are written under.
     *
     * The symlink case is the one that needed a decision: the row was
     * highlighted on `isSymlink` alone, so the link still has to be followed
     * here. When it does lead to a directory, the destination is the **link's**
     * own path rather than the target's — the server resolves it, and it is the
     * location the user aimed at. `openEntry()` navigates the same way.
     */
    private async resolveDestination (aimed: SFTPFile|'up'|null, intent: 'upload'|'move' = 'upload'): Promise<string> {
        if (aimed === null) {
            return this.path
        }
        if (aimed === 'up') {
            return posix.dirname(this.path)
        }
        if (!aimed.isSymlink) {
            return aimed.fullPath
        }
        const target = await this.resolveSymlink(aimed).catch(() => null)
        if (target && this.isDirectoryEntry(target)) {
            return aimed.fullPath
        }
        // Said out loud rather than silently retargeted: the row lit up, and
        // nothing is going there. The two outcomes differ — files fall back to
        // the directory on screen, whereas a move to it is no move at all,
        // since that is where the dragged row already lives.
        this.notices.notice(intent === 'move'
            ? `${aimed.name} n’est pas un dossier — rien n’a été déplacé`
            : `${aimed.name} n’est pas un dossier — envoi dans ${this.path}`)
        return this.path
    }

    /** Flattens what was dropped into what has to be created and what has to be sent. */
    private async planFromEntries (entries: FileSystemEntry[], base: string): Promise<DropPlan> {
        const plan: DropPlan = { directories: [], files: [] }
        const walk = async (entry: FileSystemEntry, at: string): Promise<void> => {
            if (entry.isFile) {
                plan.files.push({
                    file: await entryFile(entry as FileSystemFileEntry),
                    remotePath: posix.join(at, entry.name),
                })
                return
            }
            if (!entry.isDirectory) {
                return
            }
            const directory = posix.join(at, entry.name)
            plan.directories.push(directory)
            for (const child of await readAllEntries((entry as FileSystemDirectoryEntry).createReader())) {
                await walk(child, directory)
            }
        }
        for (const entry of entries) {
            await walk(entry, base)
        }
        return plan
    }

    /**
     * Which of the planned files already exist on the server.
     *
     * `SFTPSession.upload()` writes to `<path>.tabby-upload` and renames it
     * over the target, so an existing file is replaced without a word. That was
     * tolerable while a drop could only land in the directory on screen; now
     * that any row can be aimed at, a slip of the cursor is enough.
     *
     * One listing per destination directory rather than one lookup per file:
     * `readRemoteEntry()` reads the parent listing anyway, so asking it file by
     * file would re-read the same directory N times. A directory that does not
     * exist yet simply answers nothing, which is the right answer. And never a
     * `stat()`, which follows links and reports a dangling one as free (piège
     * #50).
     */
    private async findCollisions (files: PlannedUpload[]): Promise<string[]> {
        const byDirectory = new Map<string, PlannedUpload[]>()
        for (const file of files) {
            const parent = posix.dirname(file.remotePath)
            const bucket = byDirectory.get(parent)
            if (bucket) {
                bucket.push(file)
            } else {
                byDirectory.set(parent, [file])
            }
        }
        const collisions: string[] = []
        for (const [directory, bucket] of byDirectory) {
            const entries = await this.sftp.readdir(directory).catch(() => [])
            const existing = new Set(entries.map(entry => entry.name))
            for (const file of bucket) {
                if (existing.has(posix.basename(file.remotePath))) {
                    collisions.push(posix.basename(file.remotePath))
                }
            }
        }
        return collisions
    }

    /** Names enumerated up to this many; past it, a count. A modal listing forty files says nothing. */
    private static readonly COLLISIONS_NAMED = 5

    private async confirmOverwrite (collisions: string[], destination: string): Promise<boolean> {
        const named = collisions.slice(0, SidebarPlusSftpBrowserComponent.COLLISIONS_NAMED)
        const rest = collisions.length - named.length
        const list = named.join(', ') + (rest > 0 ? `, et ${rest} autre${rest > 1 ? 's' : ''}` : '')
        const head = collisions.length > 1
            ? `${collisions.length} fichiers existent déjà sous ${destination} et seront écrasés`
            : `Un fichier existe déjà sous ${destination} et sera écrasé`
        return await this.ask(`${head} : ${list}. Continuer ?`, 'Écraser')
    }

    /**
     * Runs a plan through to the end and answers with the names that failed.
     *
     * Each transfer is built and registered when its turn comes rather than up
     * front. The panel's elapsed time counts from the moment a line is
     * registered, so queueing fifty of them at once would show forty-nine
     * clocks running against 0 % — forty-nine transfers that read as stalled
     * when they have simply not started. The uploads are sequential: one SFTP
     * channel carries them all.
     */
    private async runPlan (plan: DropPlan): Promise<string[]> {
        for (const directory of plan.directories) {
            // A directory that already exists is the normal case when merging
            // into an existing tree; the native panel ignores the same failure.
            await this.sftp.mkdir(directory).catch(() => undefined)
        }
        const failed: string[] = []
        for (const planned of plan.files) {
            const transfer = new HTMLFileUpload(planned.file)
            this.registry.track(transfer, false, {
                remotePath: planned.remotePath,
                sessionLabel: this._sessionLabel ?? undefined,
            })
            try {
                await this.sftp.upload(planned.remotePath, transfer)
            } catch (e) {
                // The registry only ever learns of a cancellation or a
                // completion: a transfer whose channel died answers false to
                // both, and its line would stay "en cours" for the rest of the
                // session. Reported per file here, and summed up once below —
                // one toast per failure would bury the list under itself when
                // the transport is what died.
                this.registry.markFailed(transfer, String((e as Error)?.message ?? e))
                failed.push(planned.file.name)
            }
        }
        return failed
    }

    private reportDrop (plan: DropPlan, failed: string[], destination: string): void {
        const sent = plan.files.length - failed.length
        const folders = plan.directories.length
        if (sent > 0) {
            this.notices.notice(
                `${sent} fichier${sent > 1 ? 's' : ''} envoyé${sent > 1 ? 's' : ''} vers ${destination}`
                + (folders > 0 ? ` (${folders} dossier${folders > 1 ? 's' : ''})` : ''),
            )
        } else if (folders > 0 && !failed.length) {
            this.notices.notice(`${folders} dossier${folders > 1 ? 's' : ''} créé${folders > 1 ? 's' : ''} dans ${destination}`)
        }
        if (failed.length) {
            this.notices.error(
                `${failed.length} fichier${failed.length > 1 ? 's' : ''} sur ${plan.files.length} n’${failed.length > 1 ? 'ont' : 'a'} pas pu être envoyé${failed.length > 1 ? 's' : ''}`,
                failed.slice(0, SidebarPlusSftpBrowserComponent.COLLISIONS_NAMED).join(', '),
            )
        }
    }

    ////// MOVING A ROW WITHIN THE SERVER //////
    /**
     * The row a drag started from, for as long as the gesture lasts.
     *
     * Kept here rather than read from the `DataTransfer` because `getData()` is
     * write-only until the drop: during `dragover` the engine exposes the list
     * of types and nothing else, and the target highlight has to be decided on
     * every one of those events. Null while nothing is being dragged, and null
     * as well for the gestures that call `preventDefault()` — those have no HTML
     * drag, hence no move to offer and no `dragend` to clean up after.
     *
     * A panel can only ever see its own: `detachPanel()` takes the whole root
     * node out of the document, so only the focused tab's browser is there to
     * receive a drop.
     */
    private internalDragSource: SFTPFile|null = null

    /** Dims the row being moved, so the gesture reads as coming from somewhere. */
    isDragSource (item: SFTPFile): boolean {
        return this.internalDragSource?.fullPath === item.fullPath
    }

    /**
     * Ends the gesture, dropped or not.
     *
     * `dragend` fires on the source element whatever the outcome, including a
     * drop outside the window and an `Échap` — which is what makes it the one
     * reliable place to forget the source, and the one place from which a
     * directory dragged towards the OS can be recognised at all.
     */
    onDragEnd (event?: DragEvent): void {
        const candidate = this.windowExitCandidate
        const leftWindow = this.wasAimedOutOfWindow(event)
        this.stopWatchingWindowExit()
        this.internalDragSource = null
        this.clearDropTarget()
        if (candidate && leftWindow) {
            this.askedToLeave(candidate)
        }
    }

    /**
     * A directory was dragged out of the window and let go there.
     *
     * Nothing can have reached the desktop — the HTML drag carried a type the
     * OS ignores — so this is where the copy starts, and the *next* drag on the
     * same row is the one that hands it over. That two-step shape is not new:
     * it is what a directory drag-out has always done, `startDrag()` needing a
     * file that already exists on disk.
     */
    private askedToLeave (item: SFTPFile): void {
        if (!this.config.store.sidebarPlus?.sftpDragOutFolders) {
            // Kept from the gesture this replaced: without it, dragging a
            // directory to the desktop does nothing and says nothing, and the
            // setting that governs it is undiscoverable.
            this.notices.notice('Le glisser-déposer des dossiers vers l’extérieur est désactivé — activez-le dans Paramètres → Better Sidebar')
            return
        }
        this.dragOutIntent = item.fullPath
        // Cleared on refusal so that the next gesture is a move again: the
        // question `prepareDrag()` may ask is a way out, not a postponement.
        void this.prepareDrag(item, true).then(accepted => {
            if (!accepted && this.dragOutIntent === item.fullPath) {
                this.dragOutIntent = null
            }
        })
    }

    /**
     * Whether the row being dragged could land on what is currently aimed at.
     *
     * Synchronous, like `aimFrom()` and for the same reason: it runs on every
     * `dragover`. So a symlink is judged on its own path — a link leading back
     * inside the dragged directory is only caught at the drop, by the same test
     * run against the resolved destination.
     *
     * Answering false is what leaves `preventDefault()` uncalled, so the drop
     * cannot happen at all: an impossible move is refused by the cursor rather
     * than by an error message after the fact.
     */
    private canMoveTo (aimed: SFTPFile|'up'|null): boolean {
        const source = this.internalDragSource
        if (!source) {
            return false
        }
        const destination = aimed === null
            ? this.path
            : aimed === 'up' ? posix.dirname(this.path) : aimed.fullPath
        // Already there. The common one by far: the pointer spends most of a
        // drag over rows that are not directories, all of which aim at the
        // directory the entry is already in.
        if (posix.dirname(source.fullPath) === destination) {
            return false
        }
        return !this.isSelfOrDescendant(source.fullPath, destination)
    }

    /**
     * Whether a path is the other one or lives underneath it.
     *
     * The separator matters: without it `/tmp/ab` would read as being inside
     * `/tmp/a`. Same guard as the profile tree's own `isSelfOrDescendant()`,
     * against a move that would make a directory its own ancestor — the server
     * usually refuses it, but not always, and a `rename` that succeeds there
     * detaches the whole subtree.
     */
    private isSelfOrDescendant (ancestor: string, candidate: string): boolean {
        return candidate === ancestor || candidate.startsWith(ancestor.endsWith('/') ? ancestor : `${ancestor}/`)
    }

    /**
     * Moves the dragged entry into the aimed directory.
     *
     * `rename()` on a server-side move costs nothing and transfers nothing —
     * within one filesystem it is a directory entry being rewritten. Across two
     * mount points the server refuses outright, which is reported as it comes
     * rather than guessed at beforehand: SFTP has no way to ask where a path is
     * mounted.
     *
     * The announced path is checked against the remembered row rather than
     * used: a mismatch means the drag did not come from this panel's own state,
     * and the safe answer to a move whose source is uncertain is not to make it.
     */
    private async receiveMove (source: SFTPFile|null, announcedPath: string, aimed: SFTPFile|'up'|null): Promise<void> {
        if (!source || announcedPath !== source.fullPath) {
            return
        }
        const destination = await this.resolveDestination(aimed, 'move')
        // Both re-run against the *resolved* destination: a symlink is judged
        // on its own path while the cursor moves, so this is the first point at
        // which a link leading back into the dragged directory — or back into
        // the directory on screen — is visible at all.
        if (destination === posix.dirname(source.fullPath)) {
            return
        }
        if (this.isSelfOrDescendant(source.fullPath, destination)) {
            this.notices.error(`${source.name} ne peut pas être déplacé dans lui-même`)
            return
        }

        const target = posix.join(destination, source.name)
        // Refused rather than overwritten, exactly as `renameEntry()` does:
        // SFTP v3 leaves it to the server to decide what a rename onto an
        // existing name does, and some replace it. Refusing is the one answer
        // that cannot destroy anything.
        if (await readRemoteEntry(this.sftp, target)) {
            this.notices.error(`${source.name} existe déjà dans ${destination}`)
            return
        }

        try {
            await this.sftp.rename(source.fullPath, target)
        } catch (e) {
            this.notices.error(`Impossible de déplacer ${source.name} vers ${destination}`, String(e))
            return
        }

        // The entry has left the directory on screen, so the selection has
        // nothing left to point at — unlike a rename, where it follows.
        if (this.selectedPath === source.fullPath) {
            this.selectedPath = null
        }
        await this.refreshListing()
        this.notices.notice(`${source.name} déplacé vers ${destination}`)
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
        const key = selected.join('\0')
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

    /**
     * Dotfiles. Dimmed when shown, and shown by default: the `sftpShowHidden`
     * toggle in the header menu is what decides, `displayedFiles` filtering them
     * out when it is off.
     */
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
