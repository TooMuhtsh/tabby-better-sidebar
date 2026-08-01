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

    // Both take a path the npm typings know nothing about, and both skip their
    // file dialog entirely when it is supplied — which is what makes them
    // usable for a transfer to a path we chose ourselves (piège #48). Declared
    // as extra overloads: the published signatures stay valid, so any call
    // written against them keeps compiling.
    interface PlatformService {
        startDownload (name: string, mode: number, size: number, filePath: string): Promise<FileDownload|null>
        startUpload (options: FileUploadOptions, paths: string[]): Promise<FileUpload[]>
    }
}
