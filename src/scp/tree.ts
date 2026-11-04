import { promises as fs } from 'fs'
import { basename, join, posix, resolve } from 'path'
import { downloadFile, uploadFile } from './files'
import { OpenExec, Progress, parseListing, remoteFile, scpName, shellQuote } from './protocol'

/** Client-side recursion: every payload still uses legacy SCP, never SFTP. */
export interface TreeSummary {
    files: number
    directories: number
    skipped: string[]
    destination: string
}
interface TreeFile { parts: string[], source: string }
interface TreePlan { name: string, directories: string[][], files: TreeFile[], skipped: string[] }
const MAX_DEPTH = 64
const MAX_ENTRIES = 100_000

function check (signal: AbortSignal): void {
    if (signal.aborted) { throw new Error('SCP operation cancelled') }
}
function budget (count: number, depth: number): void {
    if (count > MAX_ENTRIES || depth > MAX_DEPTH) {
        throw new Error('SCP folder limit exceeded (100000 entries / 64 levels)')
    }
}

/** Reject unsafe names rather than silently rename two remote files onto one local file. */
export function localName (name: string, platform: string = process.platform): string {
    scpName(name)
    if (platform === 'win32' && (/[<>:"|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) ||
        /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:[. ]|$)/i.test(name))) {
        throw new Error('Filename is not safe on Windows: ' + name)
    }
    return name
}
export function localKey (name: string, platform: string = process.platform): string {
    localName(name, platform)
    return platform === 'win32' || platform === 'darwin' ? name.normalize('NFC').toLowerCase() : name
}

/** Unlike browsing, recursive copying must NOT follow symlinks (including broken links). */
export function treeListingCommand (path: string): string {
    if (!path.startsWith('/') || /[\0\r\n]/.test(path)) { throw new Error('Invalid SCP directory') }
    const script = '[ ! -L "$1" ] || exit 1; CDPATH=; export CDPATH; cd "$1" || exit; ' +
        '[ -r . ] && [ -x . ] || exit 1; printf "%s\\000" "$PWD"; ' +
        'for f in ./* ./.[!.]* ./..?*; do [ -e "$f" ] || [ -L "$f" ] || continue; ' +
        'k=x; if [ -L "$f" ]; then :; elif [ -d "$f" ]; then k=d; elif [ -f "$f" ]; then k=f; fi; ' +
        'printf "%s\\000%s\\000" "$k" "${f#./}"; done'
    return 'sh -c ' + shellQuote(script) + ' scp-tree ' + shellQuote(path) +
        '; r=$?; printf "\\000SCP-LIST-STATUS\\000%s\\000" "$r"'
}

async function planRemote (open: OpenExec, remote: string, signal: AbortSignal): Promise<TreePlan> {
    const plan: TreePlan = { name: localName(posix.basename(remote)), directories: [[]], files: [], skipped: [] }
    let count = 0
    const walk = async (directory: string, parts: string[]): Promise<void> => {
        check(signal)
        budget(count, parts.length)
        const stream = await open(treeListingCommand(directory), signal)
        let listing: ReturnType<typeof parseListing>
        try {
            try { listing = parseListing(await stream.output()) } catch (error) {
                throw new Error(stream.diagnostic() || String(error))
            }
        } finally { stream.close() }
        const names = new Set<string>()
        for (const entry of listing.entries) {
            check(signal)
            budget(++count, parts.length + 1)
            const source = remoteFile(directory, entry.name)
            if (entry.kind === 'x') { plan.skipped.push(source); continue }
            const key = localKey(entry.name)
            if (names.has(key)) { throw new Error('Local filename collision: ' + source) }
            names.add(key)
            const child = [...parts, entry.name]
            if (entry.kind === 'd') {
                plan.directories.push(child)
                await walk(source, child)
            } else { plan.files.push({ parts: child, source }) }
        }
    }
    await walk(remote, [])
    return plan
}

async function planLocal (local: string, signal: AbortSignal): Promise<TreePlan> {
    const plan: TreePlan = { name: scpName(basename(local)), directories: [[]], files: [], skipped: [] }
    let count = 0
    const walk = async (directory: string, parts: string[]): Promise<void> => {
        check(signal)
        budget(count, parts.length)
        const stat = await fs.lstat(directory)
        if (!stat.isDirectory() || stat.isSymbolicLink()) { throw new Error('Not a regular directory: ' + directory) }
        for (const name of await fs.readdir(directory)) {
            check(signal)
            budget(++count, parts.length + 1)
            const source = join(directory, name)
            const entry = await fs.lstat(source)
            if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
                plan.skipped.push(source)
                continue
            }
            scpName(name)
            const child = [...parts, name]
            if (entry.isDirectory()) {
                plan.directories.push(child)
                await walk(source, child)
            } else { plan.files.push({ parts: child, source }) }
        }
    }
    await walk(local, [])
    return plan
}

/** Check parents again before each write/read: a replaced directory must not become a link. */
async function localParents (root: string, parts: string[], signal: AbortSignal): Promise<void> {
    let current = root
    for (const part of ['', ...parts]) {
        check(signal)
        if (part) { current = join(current, part) }
        const stat = await fs.lstat(current)
        if (!stat.isDirectory() || stat.isSymbolicLink()) { throw new Error('Directory changed during transfer: ' + current) }
    }
}

/** Create one directory only; refuse existing symlinks and non-directory conflicts. */
async function ensureRemoteDirectory (open: OpenExec, path: string, signal: AbortSignal): Promise<void> {
    check(signal)
    const script = '[ ! -L "$1" ] || exit 1; ' +
        'if [ -e "$1" ]; then [ -d "$1" ]; else (umask 077; mkdir "$1"); fi'
    const command = 'sh -c ' + shellQuote(script) + ' scp-mkdir ' + shellQuote(path) +
        '; r=$?; printf "\\000SCP-MKDIR-STATUS\\000%s\\000" "$r"'
    const stream = await open(command, signal)
    try {
        if ((await stream.output()).toString('utf8') !== '\0SCP-MKDIR-STATUS\x000\0') {
            throw new Error(stream.diagnostic() || 'Cannot create directory (file or symbolic link conflict): ' + path)
        }
    } finally { stream.close() }
}

function remoteChild (root: string, parts: string[]): string {
    return parts.reduce((parent, name) => remoteFile(parent, name), root)
}
function fileProgress (index: number, count: number, progress: Progress): Progress {
    // Overall progress is file-weighted, not an inaccurate byte-total estimate.
    return (done, total) => progress(index + (total ? Math.min(1, done / total) : 0), Math.max(1, count))
}
function summary (plan: TreePlan, destination: string): TreeSummary {
    return { files: plan.files.length, directories: plan.directories.length, skipped: plan.skipped, destination }
}

/** Merge into the remote folder after the UI's explicit overwrite confirmation. */
export async function uploadDirectory (open: OpenExec, local: string, directory: string, signal: AbortSignal, progress: Progress): Promise<TreeSummary> {
    const root = resolve(local)
    const plan = await planLocal(root, signal)
    const destination = remoteFile(directory, plan.name)
    try {
        for (const parts of plan.directories) {
            await localParents(root, parts, signal)
            await ensureRemoteDirectory(open, remoteChild(destination, parts), signal)
        }
        for (let index = 0; index < plan.files.length; index++) {
            check(signal)
            const file = plan.files[index]
            const parents = file.parts.slice(0, -1)
            await localParents(root, parents, signal)
            const stat = await fs.lstat(file.source)
            if (!stat.isFile() || stat.isSymbolicLink()) { throw new Error('File changed during transfer: ' + file.source) }
            // Check every destination parent again; never follow a directory link.
            for (let depth = 0; depth <= parents.length; depth++) {
                await ensureRemoteDirectory(open, remoteChild(destination, parents.slice(0, depth)), signal)
            }
            await uploadFile(open, file.source, remoteChild(destination, parents), signal, fileProgress(index, plan.files.length, progress))
            progress(index + 1, Math.max(1, plan.files.length))
        }
        check(signal)
        progress(1, 1)
        return summary(plan, destination)
    } catch (error) {
        throw new Error(String(error) + '\nFolder upload is partial; completed files/directories remain at: ' + destination)
    }
}

/** Reserve a fresh destination atomically; never merge into or overwrite a local folder. */
async function reserveDirectory (parent: string, name: string, signal: AbortSignal): Promise<string> {
    for (let suffix = 1; suffix <= 10000; suffix++) {
        check(signal)
        const candidate = join(parent, suffix === 1 ? name : `${name} (${suffix})`)
        try { await fs.mkdir(candidate, { mode: 0o700 }); return candidate } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') { throw error }
        }
    }
    throw new Error('Could not reserve a new local folder name')
}

/** On failure remove only the freshly reserved folder; existing local data is untouched. */
export async function downloadDirectory (open: OpenExec, remote: string, parent: string, signal: AbortSignal, progress: Progress): Promise<TreeSummary> {
    const plan = await planRemote(open, remote, signal)
    const destination = await reserveDirectory(resolve(parent), plan.name, signal)
    try {
        for (const parts of plan.directories.slice(1)) {
            await localParents(destination, parts.slice(0, -1), signal)
            await fs.mkdir(join(destination, ...parts), { mode: 0o700 })
        }
        for (let index = 0; index < plan.files.length; index++) {
            check(signal)
            const file = plan.files[index]
            const target = join(destination, ...file.parts)
            await localParents(destination, file.parts.slice(0, -1), signal)
            await downloadFile(open, file.source, target, signal, fileProgress(index, plan.files.length, progress))
            progress(index + 1, Math.max(1, plan.files.length))
        }
        check(signal)
        progress(1, 1)
        return summary(plan, destination)
    } catch (error) {
        try { await fs.rm(destination, { recursive: true, force: true }) } catch {
            throw new Error(String(error) + '\nCould not remove partial download: ' + destination)
        }
        throw error
    }
}
