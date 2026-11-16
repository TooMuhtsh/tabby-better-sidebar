import { Injectable } from '@angular/core'
import { SFTPPanelComponent } from 'tabby-ssh'

/** The live SFTP transport, borrowed from the one member that publicly exposes its type. */
type SftpSession = SFTPPanelComponent['sftp']

/**
 * One entry remembered by the SFTP clipboard. Only what a paste needs, read
 * at copy time from the listing.
 *
 * For a symlink, `isDirectory`, `size` and `mode` describe the target. A copy
 * writes the target's content, and the link's own mode (0777 on most servers)
 * must never end up on a regular file.
 */
export interface SftpClipboardEntry {
    readonly name: string
    readonly path: string
    readonly isDirectory: boolean
    readonly size: number
    readonly mode: number
}

/** Why an entry cannot land where it was pasted. */
export type PasteRejection = 'inside' | 'here'

export interface PastePlan {
    /** Entries that can go to the destination. Name collisions are settled afterwards. */
    accepted: SftpClipboardEntry[]
    /** Entries refused before anything is asked, with the reason. */
    rejected: { entry: SftpClipboardEntry, reason: PasteRejection }[]
    /** True when the accepted entries are renamed (a cut within one session) rather than transferred. */
    byRename: boolean
}

/**
 * Whether `candidate` is `ancestor` itself or lives underneath it.
 *
 * The separator matters. Without it `/tmp/ab` would read as being inside
 * `/tmp/a`. A move or copy judged this way would make a directory its own
 * ancestor. Some servers accept that `rename`, and a copy that walks its own
 * output never ends.
 */
export function isPathInside (ancestor: string, candidate: string): boolean {
    return candidate === ancestor || candidate.startsWith(ancestor.endsWith('/') ? ancestor : `${ancestor}/`)
}

/** A remote directory without its trailing slashes, the root excepted. */
function trimDirectory (remotePath: string): string {
    const trimmed = remotePath.replace(/\/+$/, '')
    return trimmed === '' ? '/' : trimmed
}

/** Parent directory of a remote path, without pulling `path` into this module. */
function parentOf (remotePath: string): string {
    const trimmed = trimDirectory(remotePath)
    const slash = trimmed.lastIndexOf('/')
    return slash <= 0 ? '/' : trimmed.slice(0, slash)
}

/**
 * Decides what a paste does with each entry, before anything touches the
 * server. Pure on purpose, so the part that can destroy files when it is wrong
 * is testable without an SFTP session.
 *
 * A cut within the session the entries came from is a rename. Everything else
 * is a download followed by an upload, a cut across two sessions included (the
 * originals stay where they are). An entry is refused when the destination is
 * inside it, and a cut is refused when it would land in the folder it already
 * lives in. Names already taken are not decided here, since the caller asks the user.
 */
export function planPaste (options: {
    entries: readonly SftpClipboardEntry[]
    destination: string
    sameSession: boolean
    cut: boolean
}): PastePlan {
    const byRename = options.cut && options.sameSession
    const plan: PastePlan = { accepted: [], rejected: [], byRename }
    for (const entry of options.entries) {
        if (isPathInside(entry.path, options.destination)) {
            plan.rejected.push({ entry, reason: 'inside' })
            continue
        }
        if (byRename && parentOf(entry.path) === trimDirectory(options.destination)) {
            plan.rejected.push({ entry, reason: 'here' })
            continue
        }
        plan.accepted.push(entry)
    }
    return plan
}

/**
 * Which clipboard a paste reads.
 *
 * Two clipboards are in play: the panel's own (remote entries) and the one of
 * the system (local files copied in Explorer, Finder or a Linux file manager).
 * The system one wins only when its file list changed since the last copy or
 * cut made in a panel, and since the last paste taken from it. Otherwise
 * files copied in Explorer an hour ago would win over a remote file copied a
 * second ago, which is the bug this rule exists for.
 *
 * `os` is a fingerprint of the system file list, empty when it holds no file.
 * The system clipboard has no change counter Electron exposes, so copying the
 * very same files again in the file manager is not seen as new.
 */
export function pickPasteSource (state: {
    os: string
    panelHasEntries: boolean
    osAtPanelCopy: string|undefined
    lastOsPaste: string|undefined
}): 'os'|'panel'|'none' {
    const osIsNew = state.os !== '' && state.os !== state.lastOsPaste
        && (!state.panelHasEntries || state.os !== state.osAtPanelCopy)
    if (osIsNew) {
        return 'os'
    }
    if (state.panelHasEntries) {
        return 'panel'
    }
    // Same files as the previous paste, and pasting them twice is legitimate.
    return state.os !== '' ? 'os' : 'none'
}

/** What a key does in the SFTP panel, when it does anything. */
export type PanelKeyAction = 'copy'|'cut'|'paste'|'open'|'up'

/** The parts of a `KeyboardEvent` `routePanelKey()` reads. */
export interface PanelKey {
    key: string
    code: string
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    altKey: boolean
    isComposing?: boolean
}

/**
 * Decides whether a key belongs to the SFTP panel, and what it does there.
 *
 * Kept apart from the DOM so the rule that protects the terminal is tested.
 * A key whose target is not inside the panel is never ours, whatever was
 * clicked before. Otherwise a Ctrl+C typed in the terminal after a click in
 * the panel would copy files and never reach the shell as SIGINT.
 *
 *   - `inPanel`: the event target is inside this panel (and the panel is on screen).
 *   - `inField`: the target is a field of the panel (path, filter). Fields keep every key.
 *   - `onControl`: the target is a button or a link, which answers to Enter itself.
 *
 * Ctrl on Windows and Linux, Cmd on macOS. With Shift the key is left alone,
 * because Tabby binds the terminal's own copy and paste to Ctrl+Shift+C and
 * Ctrl+Shift+V. The letter follows the keyboard layout (`key`), and the
 * physical key (`code`) is used for layouts whose letters are not Latin.
 */
export function routePanelKey (event: PanelKey, context: {
    platform: string
    inPanel: boolean
    inField: boolean
    onControl: boolean
    canGoUp: boolean
}): PanelKeyAction|null {
    if (!context.inPanel || context.inField || event.altKey || event.isComposing) {
        return null
    }
    const command = context.platform === 'darwin'
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey
    if (command) {
        if (event.shiftKey) {
            return null
        }
        const letter = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : event.code.replace(/^Key/, '').toLowerCase()
        return letter === 'c' ? 'copy' : letter === 'x' ? 'cut' : letter === 'v' ? 'paste' : null
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey || context.onControl) {
        return null
    }
    if (event.key === 'Enter') {
        return 'open'
    }
    if (event.key === 'Backspace' && context.canGoUp) {
        return 'up'
    }
    return null
}

/**
 * The file clipboard, shared by every SFTP panel.
 *
 * App wide on purpose. Copying in one panel and pasting in another is the
 * point, and a panel is torn down and rebuilt whenever the sidebar switches
 * tabs. The source session is kept as an opaque reference, since the only question
 * asked of it is whether a paste lands in the same session.
 *
 * The entries are frozen copies. A paste works on its own list of names and
 * never writes back here, so a "keep both" rename in one paste cannot leak
 * into the next one.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusSftpClipboardService {
    private _entries: readonly SftpClipboardEntry[] = Object.freeze([])
    private _cut = false
    private _source: SftpSession|null = null
    private sourceClosed: { unsubscribe: () => void }|null = null

    /** Fingerprint of the system clipboard when the panel clipboard was last filled. See `pickPasteSource()`. */
    osAtPanelCopy: string|undefined = undefined
    /** Fingerprint of the system clipboard the last upload from it came from. */
    lastOsPaste: string|undefined = undefined

    get entries (): readonly SftpClipboardEntry[] {
        return this._entries
    }

    get cut (): boolean {
        return this._cut
    }

    /** Session the entries were copied from. A cut pasted into it is a rename. */
    get sourceSession (): SftpSession|null {
        return this._source
    }

    get hasEntries (): boolean {
        return this._entries.length > 0
    }

    get count (): number {
        return this._entries.length
    }

    set (entries: readonly SftpClipboardEntry[], cut: boolean, source: SftpSession|null, osFingerprint: string): void {
        this.clear()
        this._entries = Object.freeze(entries.map(entry => Object.freeze({
            name: entry.name,
            path: entry.path,
            isDirectory: entry.isDirectory,
            size: entry.size,
            mode: entry.mode,
        })))
        this._cut = cut
        this._source = source
        this.osAtPanelCopy = osFingerprint
        // A closed session cannot be read from any more, so the entries would only
        // produce errors at the next paste. Duck typed, since `closed$` is the
        // one public sign of it and tests run without rxjs.
        const closed$ = (source as any)?.closed$
        if (closed$ && typeof closed$.subscribe === 'function') {
            this.sourceClosed = closed$.subscribe(() => {
                if (this._source === source) {
                    this.clear()
                }
            })
        }
    }

    /** Whether the clipboard was filled from this very session. */
    isFrom (source: SftpSession): boolean {
        return this._source !== null && this._source === source
    }

    /** Emptied after a cut has landed, so a second paste cannot move what is no longer there. */
    clear (): void {
        this.sourceClosed?.unsubscribe()
        this.sourceClosed = null
        this._entries = Object.freeze([])
        this._cut = false
        this._source = null
    }
}
