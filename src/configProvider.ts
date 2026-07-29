import { ConfigProvider } from 'tabby-core'

export interface SidebarWorkspace {
    id: string
    name: string
    // Exclusion lists, not inclusion lists: a profile/group created after a
    // workspace exists must stay visible by default in every workspace
    // (matches the roadmap's "masquer = décocher" framing — hiding is an
    // explicit action, not an opt-in). The "Tous" workspace is virtual (not
    // stored here at all) and is exactly the zero-exclusions case.
    hiddenProfileIds: string[]
    hiddenGroupIds: string[]
    favorites: string[]
    favoriteGroups: string[]
    // Sibling order is independent per workspace (user request, 2026-07-28)
    // — same shape/semantics as the top-level sidebarPlus.groupOrder below,
    // just scoped to this workspace. A group/profile absent from these maps
    // falls back to the "Tous" order (native weight for profiles, the
    // top-level groupOrder for groups) until the user reorders it here.
    groupOrder: Record<string, string[]>
    profileOrder: Record<string, string[]>
}

export class SidebarPlusConfigProvider extends ConfigProvider {
    defaults = {
        sidebarPlus: {
            enabled: true,
            favorites: [] as string[],
            favoriteGroups: [] as string[],
            recentIcons: [] as string[],
            // Pinned icons, deliberately separate from recentIcons: that list
            // is a usage trail and evicts its oldest entry once full, so an
            // icon the user wants permanently at hand cannot live there.
            favoriteIcons: [] as string[],
            groupOrder: {} as Record<string, string[]>,
            // favorites/favoriteGroups above double as the "Tous" workspace's
            // own favorites (no migration needed — they're already live in
            // the user's config.yaml). Each entry here carries its own.
            workspaces: [] as SidebarWorkspace[],
        },
    }
}
