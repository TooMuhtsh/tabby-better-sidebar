// The tabby-core typings published on npm lag behind the Tabby desktop app's
// actual runtime API (observed: npm "nightly" tag vs. locally installed 1.0.235).
// These fields/methods exist at runtime; this augmentation just restores their types.
import 'tabby-core'

declare module 'tabby-core' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ProfileGroup {
        parentGroupId?: string
        icon?: string
        color?: string
    }

    interface ProfilesService {
        buildGroupTree<T extends ProfileGroup & { children: any }> (
            groups: PartialProfileGroup<T>[]
        ): PartialProfileGroup<T>[]
    }
}
