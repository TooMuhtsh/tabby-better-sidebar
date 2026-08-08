import { SidebarWorkspace } from './configProvider'
import { TranslatableMessage } from './i18nMessage'
import { sanitizeSvgIcon } from './svgSanitizer'

/**
 * Sharing a workspace as JSON: what goes out, and how what comes back in is
 * read.
 *
 * Same shape as `groupShare.ts`, on purpose — read that file first, this one
 * follows its pattern rather than reinventing one. Kept out of the tree
 * component for the same reason too: building/parsing/validating a workspace
 * is a pure function over plain objects, and `sidebarTree.component.ts` is
 * already ~4900 lines.
 *
 * There is no purge here, unlike the group's. A workspace carries only ids —
 * an exclusion list and a couple of order maps — never a profile's `options`,
 * so there is nothing secret to strip on the way out or the way back in.
 */

export const SHARE_FORMAT = 'tabby-better-sidebar/workspace'
export const SHARE_VERSION = 1

/**
 * What travels. No `id` — a pasted workspace always gets a fresh one, exactly
 * like a pasted folder (see `generateWorkspaceId()` below and
 * `applySharedGroup()` in groupShare's caller).
 */
export interface SharedWorkspace {
    name?: string
    icon?: string
    color?: string
    hiddenProfileIds: string[]
    hiddenGroupIds: string[]
    favorites: string[]
    favoriteGroups: string[]
    groupOrder: Record<string, string[]>
    profileOrder: Record<string, string[]>
}

export interface WorkspaceSharePayload {
    format: string
    version: number
    workspace: SharedWorkspace
}

/** Above this, the clipboard is not holding a workspace and parsing it would be pointless work. */
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024

/** A plain icon class (e.g. an Iconify name) has no reason to run long — generous cap against clipboard garbage. */
const MAX_ICON_CLASS_LENGTH = 200

function cloneOrderMap (map: Record<string, string[]> | undefined): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(map ?? {})) {
        out[key] = [...value]
    }
    return out
}

/**
 * Everything a workspace carries, minus its id, ready to be copied to the
 * clipboard.
 */
export function buildWorkspacePayload (workspace: SidebarWorkspace): WorkspaceSharePayload {
    const out: SharedWorkspace = {
        hiddenProfileIds: [...workspace.hiddenProfileIds],
        hiddenGroupIds: [...workspace.hiddenGroupIds],
        favorites: [...workspace.favorites],
        favoriteGroups: [...workspace.favoriteGroups],
        groupOrder: cloneOrderMap(workspace.groupOrder),
        profileOrder: cloneOrderMap(workspace.profileOrder),
    }
    if (workspace.name !== undefined) {
        out.name = workspace.name
    }
    if (workspace.icon !== undefined) {
        out.icon = workspace.icon
    }
    if (workspace.color !== undefined) {
        out.color = workspace.color
    }
    return { format: SHARE_FORMAT, version: SHARE_VERSION, workspace: out }
}

export interface ParseWorkspaceResult {
    payload?: WorkspaceSharePayload
    /**
     * Why it was refused, as a message key and its params — same discipline
     * as `groupShare.ts`'s `ParseResult.error`, this module has no injector
     * access either. Set when `payload` is not.
     */
    error?: TranslatableMessage
}

function asString (value: unknown): string|undefined {
    return typeof value === 'string' ? value : undefined
}

function asStringArray (value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/** `groupOrder`/`profileOrder`: a map of parent/group id to an ordered array of ids — checked one level deep, same as everything else here. */
function asOrderMap (value: unknown): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return out
    }
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        out[key] = asStringArray(entry)
    }
    return out
}

/**
 * `icon` can be either an Iconify class name or a raw custom SVG string
 * (anything starting with `<`) — same two shapes the picker itself produces
 * (`applyCustomSvg()`/`selectIconClass()` in sidebarTree.component.ts).
 *
 * A pasted workspace's icon is rendered by the same `<profile-icon>` that
 * does a raw `innerHTML = value` for a string starting with `<`
 * (svgSanitizer.ts's own docstring) — so an SVG coming in through this path
 * gets exactly the sanitisation the picker's custom-SVG input gets, rather
 * than being trusted because it arrived via config instead of a text box.
 */
function sanitiseIcon (value: unknown): string|undefined {
    if (typeof value !== 'string') {
        return undefined
    }
    const text = value.trim()
    if (!text) {
        return undefined
    }
    if (text.startsWith('<')) {
        const result = sanitizeSvgIcon(text)
        return result.ok ? result.svg : undefined
    }
    return text.length <= MAX_ICON_CLASS_LENGTH ? text : undefined
}

/**
 * Rebuilds one workspace from untrusted input, field by field — same
 * discipline as `sanitiseGroup()` in groupShare.ts: this ends up in
 * `config.store`, the clipboard is hand-editable text, and nothing is
 * believed just because the header claims a recognised format.
 *
 * **Ids in `hiddenProfileIds`/`hiddenGroupIds`/`groupOrder`/`profileOrder`
 * are kept as-is, whatever they are — never checked against
 * `config.store.profiles`/`.groups`.** Those two lists do not contain
 * provider-contributed profiles or the synthetic groups that hold them
 * (piège #74): asking "does this id still exist?" there answers *no* for
 * entries that are very much alive, and purging on that answer would drop a
 * live exclusion or ordering entry, not a stale one. And by design these
 * lists are exclusions and order maps, not references — an id that names
 * nothing at all on the importing machine excludes nothing and orders
 * nothing, it is simply inert, exactly like an id left over from a profile
 * deleted since the export. Nothing to purge, nothing at risk.
 */
function sanitiseWorkspace (raw: Record<string, unknown>): SharedWorkspace {
    return {
        name: asString(raw.name),
        icon: sanitiseIcon(raw.icon),
        color: asString(raw.color),
        hiddenProfileIds: asStringArray(raw.hiddenProfileIds),
        hiddenGroupIds: asStringArray(raw.hiddenGroupIds),
        favorites: asStringArray(raw.favorites),
        favoriteGroups: asStringArray(raw.favoriteGroups),
        groupOrder: asOrderMap(raw.groupOrder),
        profileOrder: asOrderMap(raw.profileOrder),
    }
}

/**
 * Reads what the clipboard holds, and refuses anything it does not
 * recognise. No second purge pass to speak of here (unlike groupShare's
 * `parsePayload()`) — there is nothing secret in a workspace payload to
 * begin with, so there is nothing for a re-purge to catch.
 */
export function parseWorkspacePayload (text: string): ParseWorkspaceResult {
    if (!text || !text.trim()) {
        return { error: { message: 'The clipboard is empty.' } }
    }
    if (text.length > MAX_PAYLOAD_BYTES) {
        return { error: { message: 'The clipboard content is too large to be an exported workspace.' } }
    }
    let raw: unknown
    try {
        raw = JSON.parse(text)
    } catch {
        return { error: { message: 'The clipboard does not contain JSON — copy an exported workspace first.' } }
    }
    if (!raw || typeof raw !== 'object') {
        return { error: { message: 'The clipboard does not contain an exported workspace.' } }
    }
    // Typed as a bag of unknowns rather than as a `Partial<WorkspaceSharePayload>`:
    // it is not one until every field below has been checked.
    const candidate = raw as Record<string, unknown>
    if (candidate.format !== SHARE_FORMAT) {
        return { error: { message: 'The clipboard does not contain an exported workspace.' } }
    }
    if (typeof candidate.version !== 'number' || candidate.version > SHARE_VERSION) {
        return { error: { message: 'This workspace was exported by a newer version of the plugin (format {version}).', params: { version: String(candidate.version) } } }
    }
    if (!candidate.workspace || typeof candidate.workspace !== 'object' || Array.isArray(candidate.workspace)) {
        return { error: { message: 'This exported workspace is incomplete.' } }
    }
    return {
        payload: {
            format: SHARE_FORMAT,
            version: SHARE_VERSION,
            workspace: sanitiseWorkspace(candidate.workspace as Record<string, unknown>),
        },
    }
}

/**
 * A fresh workspace id, same shape `createWorkspace()` mints in
 * sidebarTree.component.ts — kept here too so the import path never has a
 * reason to reuse the id a payload carries (piège-shaped: an id copied from
 * another machine could collide with one already in use locally).
 */
export function generateWorkspaceId (): string {
    return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * "Prod" -> "Prod (2)" -> "Prod (3)"... among existing workspace names.
 *
 * A different suffix from `copyNameFor()`/`rootGroupCopyName()`'s "X - Copie"
 * in sidebarTree.component.ts on purpose: those name a *duplicate* made in
 * place, this names an *import* landing on a taken name — same dedup shape,
 * different gesture, so a different, equally conventional suffix reads as
 * intentional rather than as the two gestures disagreeing with themselves.
 */
export function uniqueWorkspaceName (name: string, existingNames: Iterable<string>): string {
    const taken = new Set(existingNames)
    if (!taken.has(name)) {
        return name
    }
    let n = 2
    while (taken.has(`${name} (${n})`)) {
        n++
    }
    return `${name} (${n})`
}
