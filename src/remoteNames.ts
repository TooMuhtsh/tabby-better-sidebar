/**
 * Names in a remote directory: finding a free one, and settling the names a
 * paste would take that are already in use.
 *
 * No Angular and no SFTP in here. The dialog and the listing are handed in as
 * functions, so the rules (what is offered, what a dismissed dialog means, how
 * two files of one batch are kept from taking the same new name) run in a
 * plain Node test.
 */

/** What the user decided about a name that is already taken. */
export type ConflictChoice = 'overwrite'|'rename'|'skip'

export interface ConflictAnswer {
    choice: ConflictChoice
    /** The user asked for this answer to cover every remaining collision. */
    applyToAll: boolean
}

/** What the dialog is told about one collision. */
export interface ConflictQuestion {
    name: string
    /** False for a folder on either side, and then "Overwrite" is not offered at all. */
    canOverwrite: boolean
    /** More collisions wait behind this one, so "do this for the remaining files" makes sense. */
    moreToCome: boolean
}

/** One incoming entry, as far as its name is concerned. */
export interface IncomingName {
    name: string
    isDirectory: boolean
    /**
     * Set when the existing entry is this very entry (a copy pasted back into
     * its own folder). Overwriting a file with itself is never offered.
     */
    isItself?: boolean
}

/** What already sits in the destination, by name. */
export interface ExistingName {
    /** A regular file. False for a folder and for a symlink, whose replacement would be ambiguous. */
    isFile: boolean
}

export interface SettledName<T> {
    item: T
    /** The name to write under, the original one or a free one for "keep both". */
    name: string
    /** The user chose to replace the existing file of that name. Only ever true for a file onto a file. */
    overwrite: boolean
}

/**
 * A name in a remote directory that nothing there occupies yet.
 *
 * The Explorer spelling, `report (2).pdf`, because users already read it
 * without thinking and it leaves the extension at the end.
 */
export function freeRemoteName (name: string, taken: Set<string>): string {
    if (!taken.has(name)) {
        return name
    }
    const dot = name.lastIndexOf('.')
    // A leading dot marks a hidden file, not an extension, so `.bashrc` keeps
    // its whole name as the stem.
    const stem = dot > 0 ? name.slice(0, dot) : name
    const extension = dot > 0 ? name.slice(dot) : ''
    for (let n = 2; n < 10000; n++) {
        const candidate = `${stem} (${n})${extension}`
        if (!taken.has(candidate)) {
            return candidate
        }
    }
    return `${stem} (${Date.now()})${extension}`
}

/**
 * Settles every name of a paste that is already in use, before anything is
 * written.
 *
 * Rules, all of them about not losing data:
 *   - "Overwrite" is offered for a file onto a regular file only. A folder is
 *     never overwritten, because the upload of a tree starts with `mkdir`, which fails
 *     on an existing name, and a rename onto an existing folder is refused by
 *     OpenSSH. Keep both and Skip are always offered.
 *   - A dismissed dialog (`null`) means Skip.
 *   - A standing "do this for the remaining files" answer is reused, except an
 *     Overwrite on a collision that cannot be overwritten, which asks again.
 *   - Two entries of the batch never get the same name. Names the batch will
 *     write are reserved as they are decided, and a second entry with a name
 *     the batch already uses counts as a collision.
 *   - "Keep both" picks its name against a fresh listing (`relist`), since the
 *     user may have sat on the question for a while, plus the reserved names.
 *
 * Entries keep their order. The input objects are never modified.
 */
export async function settleNameCollisions<T extends IncomingName> (
    items: readonly T[],
    existing: ReadonlyMap<string, ExistingName>,
    ask: (question: ConflictQuestion) => Promise<ConflictAnswer|null>,
    relist: () => Promise<string[]>,
): Promise<{ settled: SettledName<T>[], skipped: T[] }> {
    const reserved = new Set<string>()
    const collides = items.map(() => false)
    // First pass. It finds the names that collide with the destination and
    // the names a previous entry of the batch already takes. The others are
    // reserved now, so a "keep both" further down cannot pick one of them.
    for (const [index, item] of items.entries()) {
        if (existing.has(item.name) || reserved.has(item.name)) {
            collides[index] = true
        } else {
            reserved.add(item.name)
        }
    }
    const total = collides.filter(Boolean).length
    const settled: SettledName<T>[] = []
    const skipped: T[] = []
    let standing: ConflictAnswer|null = null
    let asked = 0
    for (const [index, item] of items.entries()) {
        if (!collides[index]) {
            settled.push({ item, name: item.name, overwrite: false })
            continue
        }
        const current = existing.get(item.name)
        const canOverwrite = !item.isDirectory && !item.isItself && !!current?.isFile && !reserved.has(item.name)
        const moreToCome = asked < total - 1
        asked++
        let answer: ConflictAnswer|null = standing && (standing.choice !== 'overwrite' || canOverwrite) ? standing : null
        if (!answer) {
            answer = await ask({ name: item.name, canOverwrite, moreToCome })
            if (answer?.applyToAll) {
                standing = answer
            }
        }
        const choice = answer?.choice ?? 'skip'
        if (choice === 'skip' || (choice === 'overwrite' && !canOverwrite)) {
            skipped.push(item)
            continue
        }
        if (choice === 'overwrite') {
            reserved.add(item.name)
            settled.push({ item, name: item.name, overwrite: true })
            continue
        }
        const fresh = await relist().catch(() => [] as string[])
        const taken = new Set<string>([...existing.keys(), ...fresh, ...reserved])
        const name = freeRemoteName(item.name, taken)
        reserved.add(name)
        settled.push({ item, name, overwrite: false })
    }
    return { settled, skipped }
}
