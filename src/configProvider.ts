import { ConfigProvider } from 'tabby-core'

export class SidebarPlusConfigProvider extends ConfigProvider {
    defaults = {
        sidebarPlus: {
            enabled: true,
            favorites: [] as string[],
            recentIcons: [] as string[],
            groupOrder: {} as Record<string, string[]>,
        },
    }
}
