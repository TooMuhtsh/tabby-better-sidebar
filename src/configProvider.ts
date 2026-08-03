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

/**
 * One command of the library, written into a session from the context menu.
 *
 * A snippet is defined *once* and attached wherever it is useful — it does not
 * belong to the profile it was written from. Two consequences worth knowing
 * before touching this: fixing a command fixes it everywhere it is attached,
 * and detaching it from one profile leaves it available to every other. Which
 * of the two a gesture means is spelled out in the popup, because nothing in
 * the data can tell them apart.
 */
export interface SidebarSnippet {
    /** Stable across renames — an attachment points at this, never at a name or a position. */
    id: string
    /** What the menu shows. */
    name: string
    /** What is written into the terminal. */
    command: string
}

/**
 * How snippets behave on one profile or one folder.
 *
 * Both fields are tri-state on purpose: `undefined` means "inherit", which is
 * what lets the same setting be answered at whatever level of the tree the
 * user actually thinks about it — once on a "Prod" folder, or profile by
 * profile where one server is the exception. Resolution walks profile →
 * nearest folder → up to the root, and the first defined value wins; nothing
 * defined anywhere means `false`, so a fresh install neither launches sessions
 * nor runs anything on its own.
 *
 * Keyed by profile id *and* group id in one map: the resolution above walks
 * both kinds in the same pass, and splitting them would mean keeping two maps
 * in step through re-parenting and deletion for no gain.
 */
/**
 * How snippets behave, answered per profile/folder — and, within one of them,
 * per snippet.
 *
 * Two levels because the question is asked twice over: a profile may want most
 * of its snippets to run outright and one of them never to, which a single
 * answer per profile cannot express. Resolution therefore asks, at each link of
 * the chain, the snippet-specific answer first and the item's general one
 * second, before moving up to the folder above.
 */
export interface SidebarSnippetSettings {
    /** Open the session when the profile has none, instead of refusing to send. */
    autoLaunch?: boolean
    /** Send the trailing newline — i.e. run the command — instead of only typing it in. */
    execute?: boolean
    /**
     * Milliseconds to wait after an *automatic* launch before writing, 0 for
     * none. Never applied to a session that was already open: there is nothing
     * to wait for there.
     *
     * A blunt instrument, and knowingly so — SSH offers no "the shell is ready"
     * signal, so the alternative to a delay is guessing. It exists because the
     * guess is wrong on exactly the servers one does not administer: a long
     * MOTD swallows the command. Per profile and per folder like the two above,
     * because slowness is a property of a given server, not of the plugin.
     */
    launchDelayMs?: number
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
            // Per-block switches. All default to true: these blocks are what
            // was asked for and built, so defaulting them off would make
            // delivered features vanish on a plugin update.
            //
            // The contract is "off means gone, not merely hidden": each of
            // these also stops what feeds the block — the 2s scan skips the
            // work, the latency probe stops sending, the transfers registry
            // stops polling and unsubscribes. A switch that only hid the view
            // would tidy the screen while keeping the cost, which is the one
            // thing it must not do. See the components for where each one is
            // read; SidebarPlusTreeComponent has the getters that combine them
            // with what the host can still carry (hostCompat.ts).
            //
            // Flat keys rather than a `blocks: {...}` object on purpose:
            // mutating a nested property of sidebarPlus without reassigning it
            // never persists (piège #23), and every key must be declared here
            // to survive a restart at all (piège #16).
            showActiveSessions: true,
            showTunnels: true,
            showSftp: true,
            showTransfers: true,
            showWorkspaces: true,
            showFilter: true,
            // Éteints, les deux retirent leur entrée du menu contextuel et ce
            // qu'ils posent sur les lignes — sans toucher à ce qui est stocké :
            // la bibliothèque, les rattachements et les notes attendent d'être
            // rallumés. `showSnippets` retire aussi l'onglet de la bibliothèque
            // des réglages, et le contrôle des variables au lancement d'une
            // session ; `showNotes` retire les pastilles et cesse de chercher
            // dans les notes.
            showSnippets: true,
            showNotes: true,
            // The snippet library: every command the user has written, once
            // each, independent of where it is used. Nothing here is keyed by a
            // profile or group id, so none of it has to be migrated or
            // collected when the tree changes shape.
            snippetLibrary: [] as SidebarSnippet[],
            // Which library snippets each profile/folder offers, by id — a
            // profile shows its own attachments plus everything inherited from
            // the folders above it. Order is the order they appear in the menu.
            //
            // Keyed by id like favorites and groupOrder, with the same duty
            // attached: migrateWorkspaceGroupId() carries these over when a
            // folder is re-parented and forgetDeletedId() drops them on
            // deletion, or a folder loses its snippets the next time it is
            // dragged (piège #62). Only the *attachments* are at stake — the
            // commands themselves survive in the library either way, which is
            // precisely the point of keeping them apart.
            snippetAttachments: {} as Record<string, string[]>,
            // Per profile/folder: the answer for all its snippets at once.
            snippetSettings: {} as Record<string, SidebarSnippetSettings>,
            // Per profile/folder *and* per snippet: what one command does
            // differently from the others on that very item. Beats the map
            // above at the same link of the chain.
            snippetOverrides: {} as Record<string, Record<string, SidebarSnippetSettings>>,
            // Values a snippet is expanded with, per profile/folder *and* per
            // snippet: `{{logdir}}` written once in the library, answered
            // differently by each server.
            //
            // Keyed by snippet as well as by owner because the same name means
            // different things to different commands — one snippet's `{{path}}`
            // is a log directory, another's is a deployment root, and a single
            // answer per profile would force them to agree. The cost is
            // assumed: a name shared by three snippets is answered three times.
            snippetVariables: {} as Record<string, Record<string, Record<string, string>>>,
            // Inherited snippets switched off on one profile: still attached to
            // the folder, simply not offered here. The alternative — detaching
            // — is not available on an inherited snippet, since the attachment
            // belongs to the folder and removing it would take the snippet from
            // every other profile of that folder.
            snippetMuted: {} as Record<string, string[]>,
            // Free-text memo per profile or folder — restart commands, ticket
            // numbers, whatever has to be at hand when the session opens.
            // Deliberately *not* inherited, unlike everything else keyed this
            // way: a folder's note repeated on each of its twelve profiles
            // would be noise rather than a reminder.
            profileNotes: {} as Record<string, string>,
            // favorites/favoriteGroups above double as the "Tous" workspace's
            // own favorites (no migration needed — they're already live in
            // the user's config.yaml). Each entry here carries its own.
            workspaces: [] as SidebarWorkspace[],
        },
    }
}
