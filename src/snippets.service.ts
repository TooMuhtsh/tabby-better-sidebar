import { Injectable } from '@angular/core'
import { ConfigService, PartialProfile, PartialProfileGroup, Profile, ProfileGroup } from 'tabby-core'
import { SidebarSnippet, SidebarSnippetSettings } from './configProvider'

/** One row of the variables form — a placeholder the snippets in scope actually read. */
export interface SnippetVariableRow {
    name: string
    /** Default written in the snippet; `undefined` when the variable is required. */
    fallback?: string
    required: boolean
    /** What this very profile/folder answers, empty when it inherits. */
    own: string
    /** The value that would be substituted right now. */
    resolved?: string
    /** Where `resolved` comes from — "ici", a folder name, "profil", "défaut du snippet". */
    source: string
    /** Required and answered nowhere: every snippet using it will refuse to run. */
    unanswered: boolean
    /** Name of a snippet using it unquoted, when the value would break the command. */
    unquotedIn: string|null
}

/**
 * `{{name}}` must be answered, `{{name=fallback}}` need not be.
 *
 * Deliberately not `${name}`: that is valid shell, so a snippet legitimately
 * using a shell variable would be eaten by the expansion before the shell ever
 * saw it. Doubled braces mean nothing to a shell, which makes an unexpanded
 * placeholder visible rather than silently interpreted.
 *
 * The fallback group is `undefined` when there is no `=` at all and `''` for
 * `{{name=}}` — that difference is what separates "required" from "optional,
 * defaulting to empty", and both are legitimate.
 */
const VARIABLE_RE = /\{\{\s*([\w.-]+)\s*(?:=([^}]*))?\}\}/g

/** What makes a value break the command it is pasted into: spaces first, then what does worse than fail. */
const SHELL_UNSAFE_RE = /[\s;&|<>$`(){}[\]*?!#~"']/

/**
 * The snippet model: one library, attachments by profile/folder id, and the
 * variables and behaviours those attachments resolve against.
 *
 * A service rather than methods on the tree component because three views need
 * the same answers — the sidebar (which runs snippets), the modal (which
 * attaches them and fills their variables) and the settings tab (which writes
 * the commands). The first draft kept it all in the tree component, and the
 * settings tab had already grown its own copy of the placeholder regex.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusSnippetsService {
    /**
     * Groups as the sidebar last read them, unfiltered by workspace — needed to
     * walk a profile up to the root.
     *
     * Handed over rather than fetched: `getProfileGroups()` is async and the
     * tree already holds an unfiltered snapshot, refreshed on every load. A
     * workspace governs what is *shown*, never what a profile inherits, which
     * is why the unfiltered one is the right source (decision of 2026-07-28).
     */
    private groups: PartialProfileGroup<ProfileGroup>[] = []

    constructor (private config: ConfigService) { }

    useGroups (groups: PartialProfileGroup<ProfileGroup>[]): void {
        this.groups = groups
    }

    ////// LIBRARY //////
    get library (): SidebarSnippet[] {
        return this.config.store.sidebarPlus?.snippetLibrary ?? []
    }

    /** How many profiles and folders offer this snippet — what a deletion would take away. */
    attachmentCount (snippet: SidebarSnippet): number {
        const all: Record<string, string[]> = this.config.store.sidebarPlus?.snippetAttachments ?? {}
        return Object.values(all).filter(ids => ids.includes(snippet.id)).length
    }

    /**
     * Writes a snippet into the library, returning the stored entry.
     *
     * An edit lands in the library, so it changes the command everywhere it is
     * attached. That is what a shared library is for; both editors say so on
     * screen rather than leaving it to be found out.
     */
    async save (draft: SidebarSnippet): Promise<SidebarSnippet|null> {
        const name = draft.name.trim()
        if (!name || !draft.command.trim()) {
            return null
        }
        const library = [...this.library]
        const index = library.findIndex(s => s.id === draft.id)
        const entry: SidebarSnippet = {
            // A fresh uuid rather than a name-derived id: renaming must not
            // orphan the attachments pointing at this snippet.
            id: draft.id || crypto.randomUUID(),
            name,
            command: draft.command,
        }
        if (index === -1) {
            library.push(entry)
        } else {
            library[index] = entry
        }
        this.config.store.sidebarPlus.snippetLibrary = library
        await this.config.save()
        return entry
    }

    /**
     * Removes the command outright, and every attachment pointing at it.
     *
     * The attachments have to go in the same gesture: an id left behind
     * resolves to nothing, so the row would simply stop appearing — no error,
     * and no way to tell it apart from a snippet detached on purpose.
     */
    async deleteFromLibrary (snippet: SidebarSnippet): Promise<void> {
        this.config.store.sidebarPlus.snippetLibrary = this.library.filter(s => s.id !== snippet.id)
        const all: Record<string, string[]> = { ...(this.config.store.sidebarPlus?.snippetAttachments ?? {}) }
        for (const ownerId of Object.keys(all)) {
            const kept = all[ownerId].filter(id => id !== snippet.id)
            if (kept.length) {
                all[ownerId] = kept
            } else {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete all[ownerId]
            }
        }
        this.config.store.sidebarPlus.snippetAttachments = all
        // Everything else keyed by this snippet's id goes with it: a per-snippet
        // override or a local mute left behind would come back to life the day
        // `crypto.randomUUID()` handed the same id to another snippet — never,
        // in practice, but the entry is dead either way and it clutters
        // config.yaml.
        const overrides: Record<string, Record<string, SidebarSnippetSettings>> =
            { ...(this.config.store.sidebarPlus?.snippetOverrides ?? {}) }
        for (const ownerId of Object.keys(overrides)) {
            if (snippet.id in overrides[ownerId]) {
                const kept = { ...overrides[ownerId] }
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete kept[snippet.id]
                if (Object.keys(kept).length) {
                    overrides[ownerId] = kept
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete overrides[ownerId]
                }
            }
        }
        this.config.store.sidebarPlus.snippetOverrides = overrides

        const muted: Record<string, string[]> = { ...(this.config.store.sidebarPlus?.snippetMuted ?? {}) }
        for (const ownerId of Object.keys(muted)) {
            const kept = muted[ownerId].filter(id => id !== snippet.id)
            if (kept.length) {
                muted[ownerId] = kept
            } else {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete muted[ownerId]
            }
        }
        this.config.store.sidebarPlus.snippetMuted = muted
        await this.config.save()
    }

    ////// ATTACHMENTS //////
    attachmentsOf (ownerId: string): string[] {
        return this.config.store.sidebarPlus?.snippetAttachments?.[ownerId] ?? []
    }

    /**
     * Attachments resolved against the library, in attachment order.
     *
     * Ids the library no longer holds are dropped rather than rendered empty:
     * `deleteFromLibrary()` clears them as it goes, so one surviving here means
     * a hand-edited config, not a case worth an error message.
     */
    attachedSnippets (ownerId: string): SidebarSnippet[] {
        const library = this.library
        return this.attachmentsOf(ownerId)
            .map(id => library.find(s => s.id === id))
            .filter((s): s is SidebarSnippet => !!s)
    }

    async attach (ownerId: string, snippet: SidebarSnippet): Promise<void> {
        const attached = this.attachmentsOf(ownerId)
        if (attached.includes(snippet.id)) {
            return
        }
        await this.writeAttachments(ownerId, [...attached, snippet.id])
    }

    /** Removes it from this owner only — it stays in the library and wherever else it is attached. */
    async detach (ownerId: string, snippet: SidebarSnippet): Promise<void> {
        await this.writeAttachments(ownerId, this.attachmentsOf(ownerId).filter(id => id !== snippet.id))
    }

    private async writeAttachments (ownerId: string, ids: string[]): Promise<void> {
        this.config.store.sidebarPlus ??= {}
        // Rebuilt and reassigned rather than mutated in place — a nested write
        // is never picked up as a change to persist (piège #23).
        const all: Record<string, string[]> = { ...(this.config.store.sidebarPlus.snippetAttachments ?? {}) }
        if (ids.length) {
            all[ownerId] = ids
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete all[ownerId]
        }
        this.config.store.sidebarPlus.snippetAttachments = all
        await this.config.save()
    }

    ////// INHERITANCE //////
    /** The profile itself, then the folder holding it, then up to the root. */
    chainForProfile (profile: PartialProfile<Profile>): string[] {
        return [...(profile.id ? [profile.id] : []), ...this.groupChain(profile.group)]
    }

    /** A folder and its ancestors, nearest first. */
    groupChain (groupId: string|undefined): string[] {
        const chain: string[] = []
        // Guarded against a parent cycle: a config that somehow held one would
        // otherwise hang the renderer rather than merely misbehave.
        const seen = new Set<string>()
        while (groupId && !seen.has(groupId)) {
            seen.add(groupId)
            chain.push(groupId)
            groupId = this.groups.find(g => g.id === groupId)?.parentGroupId
        }
        return chain
    }

    groupName (groupId: string): string {
        return this.groups.find(g => g.id === groupId)?.name ?? ''
    }

    /**
     * Every snippet a profile or folder actually offers: attached along the
     * chain, deduplicated, minus the ones switched off here.
     *
     * The dedup is not cosmetic. Nothing stops the same snippet being attached
     * to a profile *and* to a folder above it — that is how it read twice in
     * the modal — and running it twice would be worse than listing it twice.
     */
    snippetsForChain (chain: string[]): SidebarSnippet[] {
        const muted = chain.length ? this.mutedOf(chain[0]) : []
        const seen = new Set<string>()
        return chain.flatMap(id => this.attachedSnippets(id)).filter(snippet => {
            if (seen.has(snippet.id) || muted.includes(snippet.id)) {
                return false
            }
            seen.add(snippet.id)
            return true
        })
    }

    ////// BEHAVIOUR SETTINGS //////
    settingsOf (ownerId: string): SidebarSnippetSettings {
        return this.config.store.sidebarPlus?.snippetSettings?.[ownerId] ?? {}
    }

    /** What one snippet does differently from the others, on this very profile or folder. */
    overrideOf (ownerId: string, snippetId: string): SidebarSnippetSettings {
        return this.config.store.sidebarPlus?.snippetOverrides?.[ownerId]?.[snippetId] ?? {}
    }

    /**
     * First defined answer, `false` when nobody has one.
     *
     * At each link of the chain the snippet's own override is asked before the
     * item's general answer, and only then does the walk move up to the folder
     * above. That order is what lets a profile run most of its snippets outright
     * and hold one of them back, while a folder still governs everything it has
     * not been contradicted on.
     */
    resolveSetting (key: 'autoLaunch'|'execute', chain: string[], snippetId?: string): boolean {
        for (const id of chain) {
            if (snippetId) {
                const specific = this.overrideOf(id, snippetId)[key]
                if (specific !== undefined) {
                    return specific
                }
            }
            const general = this.settingsOf(id)[key]
            if (general !== undefined) {
                return general
            }
        }
        return false
    }

    /** Same two-level walk for the launch delay, 0 when nobody answers. */
    resolveDelay (chain: string[], snippetId?: string): number {
        for (const id of chain) {
            if (snippetId) {
                const specific = this.overrideOf(id, snippetId).launchDelayMs
                if (specific !== undefined) {
                    return specific
                }
            }
            const general = this.settingsOf(id).launchDelayMs
            if (general !== undefined) {
                return general
            }
        }
        return 0
    }

    /** `undefined` clears the answer, putting that snippet back to whatever the item says for all of them. */
    async writeOverride (
        ownerId: string,
        snippetId: string,
        key: keyof SidebarSnippetSettings,
        value: boolean|number|undefined,
    ): Promise<void> {
        this.config.store.sidebarPlus ??= {}
        const all: Record<string, Record<string, SidebarSnippetSettings>> =
            { ...(this.config.store.sidebarPlus.snippetOverrides ?? {}) }
        const forOwner = { ...(all[ownerId] ?? {}) }
        const entry: SidebarSnippetSettings = { ...(forOwner[snippetId] ?? {}) }
        if (value === undefined) {
            delete entry[key]
        } else {
            (entry as Record<string, boolean|number>)[key] = value
        }
        if (Object.keys(entry).length) {
            forOwner[snippetId] = entry
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete forOwner[snippetId]
        }
        if (Object.keys(forOwner).length) {
            all[ownerId] = forOwner
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete all[ownerId]
        }
        this.config.store.sidebarPlus.snippetOverrides = all
        await this.config.save()
    }

    ////// LOCAL MUTING //////
    private mutedOf (ownerId: string): string[] {
        return this.config.store.sidebarPlus?.snippetMuted?.[ownerId] ?? []
    }

    isMuted (ownerId: string, snippet: SidebarSnippet): boolean {
        return this.mutedOf(ownerId).includes(snippet.id)
    }

    /** Switches an inherited snippet off here, or back on. The folder's attachment is untouched either way. */
    async toggleMuted (ownerId: string, snippet: SidebarSnippet): Promise<void> {
        const muted = this.mutedOf(ownerId)
        const next = muted.includes(snippet.id)
            ? muted.filter(id => id !== snippet.id)
            : [...muted, snippet.id]
        this.config.store.sidebarPlus ??= {}
        const all: Record<string, string[]> = { ...(this.config.store.sidebarPlus.snippetMuted ?? {}) }
        if (next.length) {
            all[ownerId] = next
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete all[ownerId]
        }
        this.config.store.sidebarPlus.snippetMuted = all
        await this.config.save()
    }

    /** `undefined` clears the answer, putting the item back to inheriting. */
    async writeSetting (ownerId: string, key: keyof SidebarSnippetSettings, value: boolean|number|undefined): Promise<void> {
        this.config.store.sidebarPlus ??= {}
        const all: Record<string, SidebarSnippetSettings> = { ...(this.config.store.sidebarPlus.snippetSettings ?? {}) }
        const entry: SidebarSnippetSettings = { ...(all[ownerId] ?? {}) }
        if (value === undefined) {
            delete entry[key]
        } else {
            // The cast is the price of one setter for a mixed-type record; the
            // two callers are typed, and the alternative is three near-identical
            // methods.
            (entry as Record<string, boolean|number>)[key] = value
        }
        // An item back to inheriting everything leaves no entry behind: an empty
        // object in config.yaml reads like a decision was made here, and none was.
        if (Object.keys(entry).length) {
            all[ownerId] = entry
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete all[ownerId]
        }
        this.config.store.sidebarPlus.snippetSettings = all
        await this.config.save()
    }

    ////// VARIABLES //////
    variablesOf (ownerId: string, snippetId: string): Record<string, string> {
        return this.config.store.sidebarPlus?.snippetVariables?.[ownerId]?.[snippetId] ?? {}
    }

    /** `null` removes the answer, which is not the same as answering with an empty string. */
    async writeVariable (ownerId: string, snippetId: string, name: string, value: string|null): Promise<void> {
        this.config.store.sidebarPlus ??= {}
        const all: Record<string, Record<string, Record<string, string>>> =
            { ...(this.config.store.sidebarPlus.snippetVariables ?? {}) }
        const forOwner = { ...(all[ownerId] ?? {}) }
        const entry = { ...(forOwner[snippetId] ?? {}) }
        if (value === null) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete entry[name]
        } else {
            entry[name] = value
        }
        if (Object.keys(entry).length) {
            forOwner[snippetId] = entry
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete forOwner[snippetId]
        }
        if (Object.keys(forOwner).length) {
            all[ownerId] = forOwner
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete all[ownerId]
        }
        this.config.store.sidebarPlus.snippetVariables = all
        await this.config.save()
    }

    /**
     * What a profile's connection already answers, without anyone typing it in.
     *
     * Bottom of the resolution order, so an explicit variable of the same name
     * wins. They exist because `{{host}}` is the first thing anyone reaches
     * for, and restating what the profile already knows would be an odd start.
     */
    implicitVariables (profile: PartialProfile<Profile>|null): Record<string, string> {
        if (!profile) {
            return {}
        }
        const options = (profile.options ?? {}) as { host?: string, user?: string, port?: number }
        const implicit: Record<string, string> = {}
        if (profile.name) {
            implicit.name = profile.name
        }
        if (options.host) {
            implicit.host = options.host
        }
        if (options.user) {
            implicit.user = options.user
        }
        if (options.port !== undefined) {
            implicit.port = String(options.port)
        }
        return implicit
    }

    /**
     * Every variable in scope, nearest definition winning.
     *
     * Built from the far end inwards — implicit values, then the root folder,
     * then down to the profile — so each assignment overwrites the one it is
     * more specific than. That asymmetry is the point: the command is shared and
     * lives in the library, while what differs between servers is answered where
     * the difference is.
     */
    resolveVariables (chain: string[], profile: PartialProfile<Profile>|null, snippetId: string): Record<string, string> {
        const values: Record<string, string> = this.implicitVariables(profile)
        for (const id of [...chain].reverse()) {
            Object.assign(values, this.variablesOf(id, snippetId))
        }
        return values
    }

    /** The placeholders a command reads, required when they carry no fallback. */
    parse (command: string): { name: string, fallback?: string, required: boolean }[] {
        const specs = new Map<string, { fallback?: string, required: boolean }>()
        // `matchAll` rather than `.exec` in a loop: the regex is a shared /g
        // literal, so a loop would carry `lastIndex` across calls and skip
        // placeholders at random.
        for (const match of command.matchAll(VARIABLE_RE)) {
            const [, name, fallback] = match
            const previous = specs.get(name)
            specs.set(name, {
                fallback: previous?.fallback ?? fallback,
                required: (previous?.required ?? false) || fallback === undefined,
            })
        }
        return [...specs.entries()].map(([name, spec]) => ({ name, ...spec }))
    }

    /**
     * Substitutes the placeholders, or names what is missing.
     *
     * Order: the profile, each folder above it, what the profile already knows,
     * and last the fallback written in the snippet. Only a placeholder with no
     * fallback and no answer anywhere counts as missing — and a snippet with one
     * is refused rather than sent half-expanded. `rm -rf {{dir}}/*` reaching a
     * shell with its braces intact is not a cosmetic problem.
     */
    expand (snippet: SidebarSnippet, chain: string[], profile: PartialProfile<Profile>|null): { text: string, missing: string[] } {
        const command = snippet.command
        const values = this.resolveVariables(chain, profile, snippet.id)
        const missing = new Set<string>()
        const text = command.replace(VARIABLE_RE, (whole: string, name: string, fallback?: string) => {
            const value = values[name] ?? fallback
            if (value === undefined) {
                missing.add(name)
                return whole
            }
            return value
        })
        return { text, missing: [...missing] }
    }

    /** Required variables this one snippet has no answer for, on this chain. */
    missingFor (snippet: SidebarSnippet, chain: string[], profile: PartialProfile<Profile>|null): string[] {
        const values = this.resolveVariables(chain, profile, snippet.id)
        return this.parse(snippet.command)
            .filter(spec => spec.required && values[spec.name] === undefined)
            .map(spec => spec.name)
    }

    /**
     * Every unanswered required variable across the snippets a profile offers,
     * as `snippet → names`.
     *
     * Grouped rather than flattened: the same name may be asked by two snippets
     * and mean two different things, so "{{path}} manque" without saying for
     * which command would send the user to the wrong field.
     */
    unansweredFor (profile: PartialProfile<Profile>): { snippet: string, names: string[] }[] {
        const chain = this.chainForProfile(profile)
        return this.snippetsForChain(chain)
            .map(snippet => ({ snippet: snippet.name, names: this.missingFor(snippet, chain, profile) }))
            .filter(entry => entry.names.length)
    }

    /**
     * The variables form: only what the snippets in scope actually read.
     *
     * Derived rather than free-form, at the user's request — a profile has no
     * business being shown a variable no snippet of its own uses. A name used
     * twice counts as required as soon as one occurrence omits its fallback:
     * that occurrence refuses to run without an answer.
     */
    variableRows (snippet: SidebarSnippet, chain: string[], profile: PartialProfile<Profile>|null): SnippetVariableRow[] {
        const own = chain.length ? this.variablesOf(chain[0], snippet.id) : {}
        const values = this.resolveVariables(chain, profile, snippet.id)
        return this.parse(snippet.command).map(spec => {
            const resolved = values[spec.name] ?? spec.fallback
            return {
                name: spec.name,
                fallback: spec.fallback,
                required: spec.required,
                own: own[spec.name] ?? '',
                resolved,
                source: this.variableSource(spec.name, chain, own, profile, snippet.id),
                unanswered: spec.required && values[spec.name] === undefined,
                unquotedIn: resolved === undefined ? null : this.unquotedUseOf(spec.name, resolved, [snippet]),
            }
        })
    }

    /** Where the effective value comes from — so an inherited answer is never mistaken for a local one. */
    private variableSource (
        name: string,
        chain: string[],
        own: Record<string, string>,
        profile: PartialProfile<Profile>|null,
        snippetId: string,
    ): string {
        if (own[name] !== undefined) {
            return 'ici'
        }
        for (const id of chain.slice(1)) {
            if (this.variablesOf(id, snippetId)[name] !== undefined) {
                return this.groupName(id) || 'dossier'
            }
        }
        if (this.implicitVariables(profile)[name] !== undefined) {
            return 'profil'
        }
        return 'défaut du snippet'
    }

    /**
     * The snippet, if any, using this variable *unquoted* — checked only when
     * the value would actually cause trouble.
     *
     * Two ways out, and the warning has to accept both, which the first version
     * did not: quoting the *placeholder in the command* (`cd "{{dir}}"`), or
     * quoting the *value itself* (`"Mon Dossier"`). The second is checked here
     * — a value already wrapped in matching quotes, with none inside, reaches
     * the shell as one word whatever the command looks like.
     *
     * The command test counts unescaped quotes before the placeholder: an odd
     * number means it sits inside a quoted string. A heuristic, not a shell
     * parser — it would be fooled by a here-doc. Being wrong costs a warning
     * that should not have appeared, never a command that should not have run.
     */
    private unquotedUseOf (name: string, value: string, snippets: SidebarSnippet[]): string|null {
        if (!SHELL_UNSAFE_RE.test(value) || this.isSelfQuoted(value)) {
            return null
        }
        for (const snippet of snippets) {
            for (const match of snippet.command.matchAll(VARIABLE_RE)) {
                if (match[1] !== name || match.index === undefined) {
                    continue
                }
                const before = snippet.command.slice(0, match.index).replace(/\\./g, '')
                const doubles = (before.match(/"/g) ?? []).length
                const singles = (before.match(/'/g) ?? []).length
                if (doubles % 2 === 0 && singles % 2 === 0) {
                    return snippet.name
                }
            }
        }
        return null
    }

    /** A value the user has already wrapped themselves — matching quotes around it, none inside. */
    private isSelfQuoted (value: string): boolean {
        const trimmed = value.trim()
        if (trimmed.length < 2) {
            return false
        }
        const quote = trimmed[0]
        if (quote !== '"' && quote !== "'") {
            return false
        }
        return trimmed.endsWith(quote) && !trimmed.slice(1, -1).includes(quote)
    }

    ////// ID LIFECYCLE //////
    /**
     * Drops everything keyed by an id that has just been deleted.
     *
     * The library is untouched: the commands outlive the profile they happened
     * to be written from, which is the point of keeping them apart.
     */
    forget (id: string): void {
        this.config.store.sidebarPlus ??= {}
        for (const map of ['snippetAttachments', 'snippetSettings', 'snippetOverrides', 'snippetVariables', 'snippetMuted'] as const) {
            const all = { ...(this.config.store.sidebarPlus[map] ?? {}) }
            if (id in all) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete all[id]
                this.config.store.sidebarPlus[map] = all
            }
        }
    }

    /**
     * Carries those same maps over when a folder is given a new id.
     *
     * Forgotten, dragging a folder into another would silently strip it of its
     * snippets — and of every snippet its profiles inherited from it (piège #62).
     */
    migrate (oldId: string, newId: string): void {
        this.config.store.sidebarPlus ??= {}
        for (const map of ['snippetAttachments', 'snippetSettings', 'snippetOverrides', 'snippetVariables', 'snippetMuted'] as const) {
            const all = { ...(this.config.store.sidebarPlus[map] ?? {}) }
            if (oldId in all) {
                all[newId] = all[oldId]
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete all[oldId]
                this.config.store.sidebarPlus[map] = all
            }
        }
    }
}
