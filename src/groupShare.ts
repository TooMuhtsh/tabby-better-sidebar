import { PartialProfile, PartialProfileGroup, Profile, ProfileGroup } from 'tabby-core'

/**
 * Sharing a folder as JSON: what goes out, what is stripped on the way, and how
 * what comes back in is read.
 *
 * Kept out of the tree component on purpose. Serialising, purging and parsing
 * are pure functions over plain objects — they need neither Angular nor the
 * config — and the component is already 3800 lines. The snippet library made
 * the same move for the same reason, one refactor too late.
 *
 * **The purge is a security question, not a convenience one.** Read
 * `purgeOptions()` before adding a field to any of the lists below.
 */

export const SHARE_FORMAT = 'tabby-better-sidebar/group'
export const SHARE_VERSION = 1

/**
 * How much is taken out.
 *
 * - `secrets` — passwords, login scripts and vault references. Everything else
 *   travels, so the export pastes back as the folder it came from. This is the
 *   one for moving between one's own machines.
 * - `credentials` — the above, plus the username, the private keys, and the
 *   route to the host (jump host, proxies, forwarded ports). The host and port
 *   stay: a structure with no host pastes into something nobody can connect to.
 */
export type PurgeLevel = 'secrets' | 'credentials'

/** What a purge took out, counted so it can be said rather than guessed at. */
export interface PurgeReport {
    /** Profiles that carried a `password`. */
    passwords: number
    /** Login scripts removed, summed over every profile. */
    scripts: number
    /** `vault://` private key references — meaningless on any other machine. */
    vaultKeys: number
    /** Private key paths removed (level `credentials` only). */
    privateKeys: number
    /** Usernames, jump hosts, proxies and forwarded ports (level `credentials` only). */
    credentials: number
    /** Fields caught by the name heuristic rather than by an explicit rule. */
    suspicious: number
}

export interface SharedProfile {
    name?: string
    type?: string
    icon?: string
    color?: string
    weight?: number
    options?: Record<string, unknown>
}

export interface SharedGroup {
    name?: string
    icon?: string
    color?: string
    /** Merged by Tabby into *every profile of the folder* — purged like any options block (piège #62). */
    defaults?: Record<string, unknown>
    profiles: SharedProfile[]
    children: SharedGroup[]
}

export interface SharePayload {
    format: string
    version: number
    /**
     * What the export took out, totalled over the whole tree.
     *
     * On the way back in this is what the payload *claims*, and it is used for
     * one thing only: telling whoever pastes what they will have to re-enter.
     * It guards nothing — see `strippedOnImport`.
     */
    removed: PurgeReport
    purge: PurgeLevel
    /**
     * What the purge had to take out *again* while reading the payload.
     *
     * Anything but zero means the JSON still carried a secret its own header
     * said had been removed — a hand-edited or foreign payload. Nothing breaks
     * (it has just been stripped), but it is worth saying.
     */
    strippedOnImport?: PurgeReport
    group: SharedGroup
}

/**
 * Removed at every level, always.
 *
 * `scripts` is here on the user's call, and it is the one field no code can
 * judge: an expect/send pair is where a sudo password gets hard-coded, and a
 * script that does that is indistinguishable from one that does not. It goes,
 * and the count says so — a login script is quick to rewrite, a leaked secret
 * is not.
 */
const ALWAYS_REMOVED = ['password', 'scripts'] as const

/**
 * Removed at level `credentials`.
 *
 * The last five are not secrets, they are the shape of a private network:
 * a jump host and a set of forwarded ports describe how someone's estate is
 * laid out, which is the part one does not hand to a third party.
 */
const CREDENTIAL_FIELDS = [
    'user',
    'privateKeys',
    'jumpHost',
    'proxyCommand',
    'socksProxyHost',
    'socksProxyPort',
    'httpProxyHost',
    'httpProxyPort',
    'forwardedPorts',
] as const

/**
 * The net under the explicit lists: any key whose *name* says it holds a
 * secret, at any depth.
 *
 * The lists above are written against `SSHProfileOptions`, which this plugin
 * can read. A third-party profile provider cannot be — and a plugin that stores
 * its token under `options.apiToken` would sail straight through a check that
 * only knows about `password`.
 *
 * Checked against every field Tabby's own SSH, local, telnet and serial
 * profiles declare: none of them matches, so this costs nothing today. It is a
 * net, not a guarantee, and the limitation is worth stating rather than
 * trusting: a provider that names its secret `options.credentials.value` is
 * caught, one that names it `options.z` is not.
 */
const SUSPICIOUS_NAME = /pass(word|phrase)|secret|token|credential|apikey|api_key/i

/** Private key entries that live in Tabby's vault — `VaultFileProvider.prefix`. */
const VAULT_PREFIX = 'vault://'

/**
 * How deep a shared tree may go, both ways.
 *
 * Folders nest freely in Tabby but not forty deep; this only has to stop a
 * hand-written payload from recursing until the renderer gives up.
 */
const MAX_DEPTH = 20

/** Above this, the clipboard is not holding a folder and parsing it would freeze the UI. */
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024

export function emptyReport (): PurgeReport {
    return { passwords: 0, scripts: 0, vaultKeys: 0, privateKeys: 0, credentials: 0, suspicious: 0 }
}

/**
 * Strips one options block, in place on a copy, counting as it goes.
 *
 * Recurses into nested objects for the name heuristic only: the explicit lists
 * describe the top level of an options block, which is where Tabby puts them,
 * and running them at depth would strip a `user` field out of some unrelated
 * nested structure.
 */
function purgeOptions (options: Record<string, unknown>, level: PurgeLevel, report: PurgeReport, depth = 0): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(options)) {
        if (depth === 0 && (ALWAYS_REMOVED as readonly string[]).includes(key)) {
            if (key === 'password' && value) {
                report.passwords++
            }
            if (key === 'scripts' && Array.isArray(value)) {
                report.scripts += value.length
            }
            continue
        }
        if (depth === 0 && level === 'credentials' && (CREDENTIAL_FIELDS as readonly string[]).includes(key)) {
            if (key === 'privateKeys' && Array.isArray(value)) {
                report.privateKeys += value.length
            } else if (value !== undefined && value !== null) {
                report.credentials++
            }
            continue
        }
        if (SUSPICIOUS_NAME.test(key)) {
            if (value !== undefined && value !== null && value !== '') {
                report.suspicious++
            }
            continue
        }
        // A key stored in the vault is a `vault://<id>` pointer, and that id
        // means nothing in anyone else's vault — including one's own on another
        // machine. Dropping it beats pasting a profile that silently fails to
        // find its key; the local paths beside it stay, they are re-creatable.
        if (depth === 0 && key === 'privateKeys' && Array.isArray(value)) {
            const kept = value.filter(entry => !(typeof entry === 'string' && entry.startsWith(VAULT_PREFIX)))
            report.vaultKeys += value.length - kept.length
            if (kept.length) {
                out[key] = kept
            }
            continue
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            out[key] = purgeOptions(value as Record<string, unknown>, level, report, depth + 1)
            continue
        }
        out[key] = value
    }
    return out
}

/**
 * A folder's `defaults`, which is one options block *per provider* and not an
 * options block itself.
 *
 * The distinction is the whole point: `defaults` is shaped
 * `{ ssh: { user, password, scripts… } }`, so its secrets sit one level deeper
 * than `purgeOptions()` looks for them, and handing the outer object over
 * straight lets `defaults.ssh.scripts` through untouched — the heuristic net
 * does not catch that name, and a folder-wide login script is merged into every
 * profile of the folder (piège #62). Each provider block is therefore purged as
 * the top-level options block it is.
 *
 * Found by the bench rather than by reading: the export looked right, and only
 * counting what came out showed a password filed under "suspicious" instead of
 * "password" — which is what said the explicit rules had never run on it.
 */
function purgeDefaults (defaults: Record<string, unknown>, level: PurgeLevel, report: PurgeReport): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [providerId, block] of Object.entries(defaults)) {
        out[providerId] = block && typeof block === 'object' && !Array.isArray(block)
            ? purgeOptions(block as Record<string, unknown>, level, report)
            : block
    }
    return out
}

/**
 * One profile, as it travels.
 *
 * A whitelist of top-level fields rather than "everything minus a few": these
 * are few, well known and none of them is a secret, whereas a field a future
 * Tabby adds is an unknown — and the wrong side to be wrong on here is the one
 * that lets an unknown through. `id` and `group` are left behind because both
 * are minted afresh on paste; `isBuiltin`/`isTemplate` because a pasted profile
 * belongs to whoever pasted it, exactly as `duplicateProfile()` decided.
 */
function shareProfile (profile: PartialProfile<Profile>, level: PurgeLevel, report: PurgeReport): SharedProfile {
    const out: SharedProfile = {}
    if (profile.name !== undefined) {
        out.name = profile.name
    }
    if (profile.type !== undefined) {
        out.type = profile.type
    }
    if (profile.icon !== undefined) {
        out.icon = profile.icon
    }
    if (profile.color !== undefined) {
        out.color = profile.color
    }
    if (profile.weight !== undefined) {
        out.weight = profile.weight
    }
    if (profile.options && typeof profile.options === 'object') {
        out.options = purgeOptions(profile.options as Record<string, unknown>, level, report)
    }
    return out
}

/**
 * A folder and everything under it.
 *
 * `defaults` travels — Tabby merges it into every profile of the folder, so
 * leaving it behind strips the pasted profiles of what they inherited (that is
 * piège #62, met once already) — but it is an options block like any other and
 * gets the same purge. A folder-wide `defaults.ssh.password` is a real thing.
 *
 * Reads the tree it is handed rather than fetching one: the caller holds an
 * unfiltered snapshot, and a workspace-filtered tree would quietly export a
 * subset of the folder.
 */
export function shareGroup (
    group: PartialProfileGroup<ProfileGroup>,
    allGroups: PartialProfileGroup<ProfileGroup>[],
    level: PurgeLevel,
    report: PurgeReport,
    depth = 0,
): SharedGroup {
    const out: SharedGroup = {
        profiles: (group.profiles ?? [])
            .filter(p => !(p as PartialProfile<Profile> & { isTemplate?: boolean }).isTemplate)
            .map(p => shareProfile(p, level, report)),
        children: [],
    }
    if (group.name !== undefined) {
        out.name = group.name
    }
    if (group.icon !== undefined) {
        out.icon = group.icon
    }
    if (group.color !== undefined) {
        out.color = group.color
    }
    const defaults = (group as PartialProfileGroup<ProfileGroup> & { defaults?: Record<string, unknown> }).defaults
    if (defaults && typeof defaults === 'object') {
        out.defaults = purgeDefaults(defaults, level, report)
    }
    if (depth < MAX_DEPTH) {
        out.children = allGroups
            .filter(g => g.parentGroupId === group.id)
            .map(child => shareGroup(child, allGroups, level, report, depth + 1))
    }
    return out
}

export function buildPayload (
    group: PartialProfileGroup<ProfileGroup>,
    allGroups: PartialProfileGroup<ProfileGroup>[],
    level: PurgeLevel,
): SharePayload {
    const removed = emptyReport()
    const shared = shareGroup(group, allGroups, level, removed)
    return { format: SHARE_FORMAT, version: SHARE_VERSION, purge: level, removed, group: shared }
}

export interface ParseResult {
    payload?: SharePayload
    /** Why it was refused, ready to show. Set when `payload` is not. */
    error?: string
}

/**
 * Reads what the clipboard holds, and refuses anything it does not recognise.
 *
 * **The purge runs again here, on the way in.** The payload says what was taken
 * out at export time, and that claim is worth exactly nothing: the JSON is text
 * from the clipboard, editable by hand and possibly written by someone else. So
 * nothing trusts `removed`, it is re-derived — a payload with a `password` left
 * in it loses it here, whatever its header says.
 */
export function parsePayload (text: string): ParseResult {
    if (!text || !text.trim()) {
        return { error: 'Le presse-papiers est vide.' }
    }
    if (text.length > MAX_PAYLOAD_BYTES) {
        return { error: 'Le contenu du presse-papiers est trop volumineux pour être un dossier partagé.' }
    }
    let raw: unknown
    try {
        raw = JSON.parse(text)
    } catch {
        return { error: "Le presse-papiers ne contient pas de JSON — copiez d'abord un dossier depuis la sidebar." }
    }
    if (!raw || typeof raw !== 'object') {
        return { error: 'Le presse-papiers ne contient pas un dossier partagé.' }
    }
    // Typed as a bag of unknowns rather than as a `Partial<SharePayload>`: it
    // is not one until every field below has been checked, and calling it one
    // first is how a cast ends up standing in for a validation.
    const candidate = raw as Record<string, unknown>
    if (candidate.format !== SHARE_FORMAT) {
        return { error: "Ce JSON n'a pas été produit par « Copier la structure » de cette sidebar." }
    }
    if (typeof candidate.version !== 'number' || candidate.version > SHARE_VERSION) {
        return { error: `Ce dossier a été exporté par une version plus récente du plugin (format ${String(candidate.version)}).` }
    }
    if (!candidate.group || typeof candidate.group !== 'object') {
        return { error: 'Ce dossier partagé est incomplet : il ne contient aucun groupe.' }
    }
    const level: PurgeLevel = candidate.purge === 'credentials' ? 'credentials' : 'secrets'
    // Two reports, and the distinction matters. `removed` is what the export
    // announced — the only thing that can say "there was a password here, you
    // will have to type it again", since by construction nothing of it is left
    // to count. `strippedOnImport` is what this pass had to remove itself, and
    // on a payload this plugin wrote it is empty: anything in it means the JSON
    // was carrying more than its header admitted.
    const strippedOnImport = emptyReport()
    const group = sanitiseGroup(candidate.group as Record<string, unknown>, level, strippedOnImport, 0)
    return {
        payload: {
            format: SHARE_FORMAT,
            version: SHARE_VERSION,
            purge: level,
            removed: readReport(candidate.removed),
            strippedOnImport,
            group,
        },
    }
}

/**
 * The export's own account of what it stripped, believed only as far as it is
 * shaped like a report.
 *
 * Every field is checked and clamped rather than copied: this ends up in a
 * sentence shown to the user, and a hand-written `{"passwords": -1e9}` would
 * otherwise print as-is. Nothing is decided on these numbers — they are a
 * message, not a control.
 */
function readReport (raw: unknown): PurgeReport {
    const out = emptyReport()
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return out
    }
    const source = raw as Record<string, unknown>
    for (const key of Object.keys(out) as (keyof PurgeReport)[]) {
        const value = source[key]
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            out[key] = Math.min(Math.floor(value), 100000)
        }
    }
    return out
}

/** Whether a report has anything to say. */
export function isEmptyReport (report: PurgeReport|undefined): boolean {
    return !report || Object.values(report).every(n => !n)
}

function asString (value: unknown): string|undefined {
    return typeof value === 'string' ? value : undefined
}

/**
 * Rebuilds one folder from untrusted input, field by field.
 *
 * Every value is type-checked rather than copied across: this ends up in
 * `config.store`, and a `name` that is an object or a `children` that is a
 * string would be written to `config.yaml` and read back by Tabby forever
 * after. What the whitelist drops is a field the paste does without; what a
 * blind copy would let in is unbounded.
 */
function sanitiseGroup (raw: Record<string, unknown>, level: PurgeLevel, report: PurgeReport, depth: number): SharedGroup {
    const out: SharedGroup = { profiles: [], children: [] }
    out.name = asString(raw.name)
    out.icon = asString(raw.icon)
    out.color = asString(raw.color)
    if (raw.defaults && typeof raw.defaults === 'object' && !Array.isArray(raw.defaults)) {
        out.defaults = purgeDefaults(raw.defaults as Record<string, unknown>, level, report)
    }
    if (Array.isArray(raw.profiles)) {
        out.profiles = raw.profiles
            .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && !Array.isArray(p))
            .map(p => {
                const profile: SharedProfile = {}
                profile.name = asString(p.name)
                profile.type = asString(p.type)
                profile.icon = asString(p.icon)
                profile.color = asString(p.color)
                if (typeof p.weight === 'number') {
                    profile.weight = p.weight
                }
                if (p.options && typeof p.options === 'object' && !Array.isArray(p.options)) {
                    profile.options = purgeOptions(p.options as Record<string, unknown>, level, report)
                }
                return profile
            })
    }
    if (Array.isArray(raw.children) && depth < MAX_DEPTH) {
        out.children = raw.children
            .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object' && !Array.isArray(c))
            .map(c => sanitiseGroup(c, level, report, depth + 1))
    }
    return out
}

/** Folders and profiles in a shared tree, for the notice and the paste modal. */
export function countPayload (group: SharedGroup): { folders: number, profiles: number } {
    let folders = 1
    let profiles = group.profiles.length
    for (const child of group.children) {
        const sub = countPayload(child)
        folders += sub.folders
        profiles += sub.profiles
    }
    return { folders, profiles }
}

/**
 * The purge, in one sentence, or empty when nothing was taken out.
 *
 * Written for the person on the other end: what is missing and has to be
 * re-entered, not what the algorithm did.
 */
export function describePurge (report: PurgeReport): string {
    const parts: string[] = []
    if (report.passwords) {
        parts.push(report.passwords > 1 ? `${report.passwords} mots de passe` : '1 mot de passe')
    }
    if (report.scripts) {
        parts.push(report.scripts > 1 ? `${report.scripts} scripts de login` : '1 script de login')
    }
    if (report.vaultKeys) {
        parts.push(report.vaultKeys > 1 ? `${report.vaultKeys} clés du coffre-fort` : '1 clé du coffre-fort')
    }
    if (report.privateKeys) {
        parts.push(report.privateKeys > 1 ? `${report.privateKeys} chemins de clé` : '1 chemin de clé')
    }
    if (report.credentials) {
        parts.push(report.credentials > 1 ? `${report.credentials} identifiants et routes` : '1 identifiant')
    }
    if (report.suspicious) {
        parts.push(report.suspicious > 1 ? `${report.suspicious} champs sensibles` : '1 champ sensible')
    }
    return parts.join(', ')
}
