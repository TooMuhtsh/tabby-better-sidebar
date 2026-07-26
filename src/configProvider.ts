import { ConfigProvider } from 'tabby-core'

export class SidebarPlusConfigProvider extends ConfigProvider {
    defaults = {
        sidebarPlus: {
            enabled: true,
        },
    }
}
