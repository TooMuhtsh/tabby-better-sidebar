// tabby-settings' published npm typings only export `SettingsTabComponent`
// from its index — `EditProfileModalComponent` is marked `@hidden` (which
// only affects generated docs, not real exports — see roadmap piège #13)
// and is genuinely present in the installed app's compiled dist/index.js
// webpack export block, just missing from the npm-published .d.ts (typings
// lagging behind the runtime app, same situation as roadmap piège #6). This
// augmentation declares it so it can be imported normally. Field names below
// match the app's actual compiled component (`partialProfile`/
// `profileProvider`), not the npm typings' mismatched `profile` field name
// (verified against C:\Program Files\Tabby\...\tabby-settings\dist\index.js).
import { PartialProfile, PartialProfileGroup, Profile, ProfileGroup, ProfileProvider } from 'tabby-core'

declare module 'tabby-settings' {
    export class EditProfileModalComponent<P extends Profile = Profile> {
        partialProfile: PartialProfile<P>
        profileProvider: ProfileProvider<P>
        defaultsMode: 'enabled'|'group'|'disabled'
        profileGroup: PartialProfileGroup<ProfileGroup>|undefined
    }
}
