import * as fs from 'fs'
import * as path from 'path'
import { electronRemote } from './electronRemote'

/**
 * The local files the user copied in the file manager of the system.
 *
 * Electron exposes the clipboard as a bag of named formats, and each system
 * names "these are files" its own way. Only formats that a file manager writes
 * for a file copy are read, never plain text, because a path typed or copied
 * as text is not a file the user copied. Nothing here runs a program.
 *
 *   - Windows: `FileNameW` (UTF-16) and its ANSI twin `FileName`. Explorer puts
 *     only the FIRST file of a selection there. The full list lives in
 *     CF_HDROP, which Electron cannot reach, because `readBuffer(name)`
 *     registers `name` as a custom format and the standard CF_HDROP has no
 *     name. The number of copied items is still readable from the
 *     `Shell IDList Array` header, which is how a multi-file copy is detected
 *     and refused instead of silently sending one file.
 *   - Linux: `text/uri-list`, and `x-special/gnome-copied-files` (GNOME Files,
 *     whose first line says "copy" or "cut").
 *   - macOS: `public.file-url`, a single selection. A multi-file Finder copy is
 *     an `NSFilenames` plist Electron has no reader for.
 *
 * Parsing is kept in standalone functions with tests, because a wrong parse
 * here means uploading the wrong local file.
 */

/** The slice of Electron's `clipboard` this module uses. */
interface ElectronClipboard {
    read: (format: string) => string
    readBuffer: (format: string) => Buffer
}

/** What the system clipboard holds, as far as files are concerned. */
export interface OsClipboardFiles {
    /**
     * Every path the clipboard names, before the existence check. Used as the
     * fingerprint of the clipboard, because a file deleted after the copy must not
     * make an old copy look new.
     */
    listed: string[]
    /** The listed paths that are absolute and still exist locally. */
    existing: string[]
    /**
     * How many items the copy really held, when the clipboard says more than
     * it lets us read (Windows, several files copied in Explorer). Null
     * otherwise.
     */
    copiedCount: number|null
}

const NO_FILES: OsClipboardFiles = { listed: [], existing: [], copiedCount: null }

function electronClipboard (): ElectronClipboard|null {
    try {
        const req = (window as any).require ?? (global as any).require
        const clipboard = req?.('electron')?.clipboard
        if (clipboard) {
            return clipboard as ElectronClipboard
        }
    } catch {
        // An Electron without the renderer module falls through to the remote.
    }
    try {
        return (electronRemote()?.clipboard ?? null) as ElectronClipboard|null
    } catch {
        return null
    }
}

/** A NUL separated list of paths, as Explorer writes it, whatever the encoding. */
function splitNulList (text: string): string[] {
    return text.split('\u0000').map(part => part.trim()).filter(part => part.length > 0)
}

/**
 * The `FileNameW` block Explorer writes. UTF-16LE paths, each terminated by a
 * NUL, the list terminated by a second one.
 */
export function parseFileNameW (buffer: Buffer): string[] {
    return splitNulList(buffer.toString('utf16le'))
}

/** The ANSI `FileName` block, written by older applications. Non-ASCII names come through mangled. */
export function parseFileName (buffer: Buffer): string[] {
    return splitNulList(buffer.toString('latin1'))
}

/**
 * The number of items in a `Shell IDList Array` block (a CIDA structure):
 * a 32-bit count, then count + 1 offsets. Null when the buffer is too short
 * to be one, so a malformed block never blocks a paste.
 */
export function parseShellIdListCount (buffer: Buffer|null|undefined): number|null {
    if (!buffer || buffer.length < 8) {
        return null
    }
    const count = buffer.readUInt32LE(0)
    if (count === 0 || buffer.length < 4 + 4 * (count + 1)) {
        return null
    }
    return count
}

/**
 * The `text/uri-list` block of Linux file managers, one URI per line where
 * `#` starts a comment. Also reads GNOME's `x-special/gnome-copied-files`, whose
 * "copy" or "cut" first line is not a URI and is dropped like any other.
 */
export function parseUriList (text: string): string[] {
    const paths: string[] = []
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) {
            continue
        }
        const local = localPathFromUri(trimmed)
        if (local) {
            paths.push(local)
        }
    }
    return paths
}

/**
 * A `file://` URI as a local path, or null for anything else.
 *
 * A URI naming another host (`file://server/share/x`) is refused. Its path
 * is not a local file, and reading it as one would upload whatever happens to
 * sit at `/share/x` on this machine.
 */
export function localPathFromUri (value: string): string|null {
    let url: URL
    try {
        url = new URL(value)
    } catch {
        return null
    }
    if (url.protocol !== 'file:' || (url.hostname !== '' && url.hostname !== 'localhost')) {
        return null
    }
    // Decoded by hand, because the pathname keeps `%20` for spaces and an
    // encoded path is not what `fs` expects.
    try {
        const pathname = decodeURIComponent(url.pathname)
        // In `file:///C:/dir` the leading slash is not part of a Windows path.
        return /^\/[a-zA-Z]:/.test(pathname) ? pathname.slice(1) : pathname
    } catch {
        return null
    }
}

/**
 * Keeps the paths a paste may upload: absolute (a relative one would resolve
 * against Tabby's working directory, which the user never chose), existing,
 * and each one once.
 */
export function usablePaths (paths: string[], exists: (p: string) => boolean): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const candidate of paths) {
        if (!candidate || !path.isAbsolute(candidate) || seen.has(candidate)) {
            continue
        }
        seen.add(candidate)
        let present = false
        try {
            present = exists(candidate)
        } catch {
            present = false
        }
        if (present) {
            out.push(candidate)
        }
    }
    return out
}

/** Reads a format, answering null for one that is absent or unreadable here. */
function tryRead<T> (read: () => T): T|null {
    try {
        return read()
    } catch {
        return null
    }
}

/**
 * Each format is tried in turn rather than asking `availableFormats()` first.
 * Chromium does not list every format it can still read, `FileNameW` being the
 * usual example, and a failed read is a cheap exception to swallow.
 */
function collect (clipboard: ElectronClipboard): { listed: string[], copiedCount: number|null } {
    if (process.platform === 'win32') {
        for (const [format, parse] of [['FileNameW', parseFileNameW], ['FileName', parseFileName]] as const) {
            const buffer = tryRead(() => clipboard.readBuffer(format))
            const listed = buffer?.length ? parse(buffer) : []
            if (listed.length) {
                const count = parseShellIdListCount(tryRead(() => clipboard.readBuffer('Shell IDList Array')))
                return { listed, copiedCount: count !== null && count > listed.length ? count : null }
            }
        }
    }
    for (const format of ['text/uri-list', 'x-special/gnome-copied-files', 'public.file-url']) {
        const text = tryRead(() => clipboard.read(format))
        const listed = text ? parseUriList(text) : []
        if (listed.length) {
            return { listed, copiedCount: null }
        }
    }
    return { listed: [], copiedCount: null }
}

/**
 * The local files on the system clipboard right now. Empty when it holds
 * anything else (text, an image, a format this module does not know).
 */
export function readOsClipboardFiles (): OsClipboardFiles {
    try {
        const clipboard = electronClipboard()
        if (!clipboard) {
            return NO_FILES
        }
        const { listed, copiedCount } = collect(clipboard)
        if (!listed.length) {
            return NO_FILES
        }
        return { listed, existing: usablePaths(listed, p => fs.existsSync(p)), copiedCount }
    } catch {
        return NO_FILES
    }
}

/** The fingerprint `pickPasteSource()` compares. Empty when no file is listed. */
export function osClipboardFingerprint (files: OsClipboardFiles): string {
    return files.listed.join('\n')
}
