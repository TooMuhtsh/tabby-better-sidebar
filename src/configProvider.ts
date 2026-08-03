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
        // Outside `sidebarPlus` on purpose: Tabby merges every provider's
        // defaults into one store, and hotkey bindings live in its own
        // top-level namespace. A HotkeyProvider without a matching default
        // here would show up in the settings with no binding at all.
        hotkeys: {
            'sidebar-plus-insert-newline': ['Ctrl-Enter'],
            // Free on Windows and Linux: Tabby binds the terminal's own search
            // to Ctrl-Shift-F there, and only macOS uses ⌘-F for it — which is
            // a different chord from this one anyway.
            'sidebar-plus-focus-filter': ['Ctrl-F'],
        },
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
            // Ids of the optional SFTP browser columns, in display order —
            // the name column is always shown and never listed here. See
            // SidebarPlusSftpBrowserComponent.AVAILABLE_COLUMNS for the ids.
            sftpColumns: ['size', 'date', 'mode'] as string[],
            // Editor a double-clicked remote file opens in — never the OS
            // association, which would *run* an executable instead of editing
            // it. Empty until the first double-click asks for one (or the
            // settings tab sets it). Prefixed like its SFTP siblings above.
            sftpEditorPath: '',
            // Which button of the SFTP delete confirmation holds the focus,
            // i.e. what `Entrée` triggers. Defaults to the non-destructive
            // answer: a confirmation whose default is "yes" deletes on a reflex
            // Entrée, and this one has no undo. 'confirm' is opt-in, from the
            // settings tab, and makes Suppr puis Entrée a single gesture.
            sftpDeleteDefaultButton: 'cancel' as 'confirm'|'cancel',
            // Whether a directory can be dragged out to the OS. Off by
            // default: `startDrag()` needs the whole tree on disk first, so the
            // gesture appears to do nothing while it downloads — with no
            // progress and no way to cancel. Files are always draggable.
            sftpDragOutFolders: false,
            // Seconds between two automatic reloads of the SFTP listing, 0 to
            // disable. Off by default: SFTP has no change notification, so a
            // refresh is a full readdir, which is not free on a large
            // directory.
            sftpAutoRefreshSeconds: 0,
            // Seconds between two latency probes of each live SSH session, 0 to
            // disable. Off by default, like the SFTP auto-refresh above and for
            // a comparable reason: a probe is a real request sent to a real
            // server, so it is opt-in rather than something the plugin starts
            // doing on its own. See ping.service.ts for what is measured.
            pingIntervalSeconds: 0,
            // Display toggles of the SFTP browser's header menu.
            sftpFoldersFirst: true,
            sftpShowHidden: true,
            sftpColumnBorders: true,
            sftpZebra: true,
            // Hides Tabby's own transfers button and dropdown from the tab bar,
            // the plugin's own panel showing the same transfers and more. On by
            // default: left visible, the native dropdown *opens by itself* on
            // every transfer, so keeping both means a popup covering the tabs on
            // top of a panel that already says it. Untick to get it back.
            hideNativeTransfersMenu: true,
            // favorites/favoriteGroups above double as the "Tous" workspace's
            // own favorites (no migration needed — they're already live in
            // the user's config.yaml). Each entry here carries its own.
            workspaces: [] as SidebarWorkspace[],
        },
    }
}
