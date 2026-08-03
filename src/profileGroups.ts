import { ConfigService, PartialProfileGroup, ProfileGroup, ProfilesService } from 'tabby-core'

/**
 * The one call this plugin makes to `getProfileGroups()`, clone included.
 *
 * The clone is not a precaution one may skip. `buildGroupTree()` writes
 * `group.children = []` straight onto the objects it is handed; if those are
 * live references into `config.store.groups`, that computed array is serialized
 * into `config.yaml` at the next `config.save()` — any save, a favourite is
 * enough — and the file comes back with duplicated and orphaned groups. That is
 * piège #12, and it corrupted the user's real configuration once.
 *
 * Two callers used to spell the same three lines, the second one right after
 * the `await`, with a comment each explaining the danger. Nothing enforced it:
 * a third caller written next year would compile, run, and quietly poison the
 * config. Spelling it once removes the discipline instead of documenting it —
 * the same move `isSSHTab()` made for `instanceof SSHTabComponent`.
 *
 * **Do not call `profilesService.getProfileGroups()` anywhere else.**
 */
export async function readProfileGroups (
    profiles: ProfilesService,
    config: ConfigService,
): Promise<PartialProfileGroup<ProfileGroup>[]> {
    const groups = await profiles.getProfileGroups({ includeNonUserGroup: true, includeProfiles: true })
    noteIfLive(groups, config)
    return structuredClone(groups)
}

/**
 * Whether the identity check below has already run. Once per session is plenty:
 * the answer comes from Tabby's code, which does not change between two calls.
 */
let identityChecked = false

/**
 * Turns "the clone is not guaranteed" into something measured rather than
 * assumed.
 *
 * As of Tabby 1.0.231-nightly the guarantee happens to hold —
 * `getSyncProfileGroups()` returns `deepClone(config.store.groups)`, and an
 * identity comparison on the running app confirms not one group comes back as
 * the same object. So the `structuredClone()` above is, today, a belt over
 * braces. It stays: the braces are an implementation detail of a method nobody
 * exported, and the failure it guards against is a corrupted config file.
 *
 * What this adds is the missing half — noticing if that ever changes. Identity,
 * not equality, is the question: `getProfileGroups()` sets `editable` and
 * `profiles` on whatever it returns, so a shared object is *not* a copy of the
 * stored one, and comparing values would find differences that prove nothing.
 *
 * Nothing is broken when this fires, which is why it does not reach the user:
 * the clone catches it. It is the plugin's own note that an assumption written
 * in a comment has gone back to being live.
 */
function noteIfLive (returned: PartialProfileGroup<ProfileGroup>[], config: ConfigService): void {
    if (identityChecked) {
        return
    }
    identityChecked = true
    const live: PartialProfileGroup<ProfileGroup>[] = config.store?.groups ?? []
    const shared = live.filter(g => returned.some(r => r === g)).length
    if (!shared) {
        return
    }
    // No ids, no names: this repository is public and these are real entries.
    console.error(
        '[tabby-better-sidebar] getProfileGroups() rend à nouveau des références vivantes de config.store.groups —',
        shared, 'sur', live.length,
        '— le structuredClone() défensif (piège #12) redevient indispensable ; ne pas le retirer.',
    )
}
