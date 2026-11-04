import { ConfigProvider } from 'tabby-core'

/** A declared namespace is required for Tabby to persist the checkbox. */
export class SidebarPlusScpConfigProvider extends ConfigProvider {
    defaults = { sidebarPlusScp: { enabled: false } }
}
