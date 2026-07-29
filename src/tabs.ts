import { AppService, BaseTabComponent, SplitTabComponent } from 'tabby-core'

/**
 * Every tab currently open, with split tabs flattened into their panes.
 *
 * `app.tabs` only lists top-level tabs: a session opened in a split pane is
 * *not* in it, only the `SplitTabComponent` wrapping it is. Three features
 * need the flattened view (live status dots, the SFTP panel's focus tracking,
 * the active sessions list), which is why this lives here rather than as a
 * private method copied into each of them.
 */
export function getAllOpenTabs (app: AppService): BaseTabComponent[] {
    return app.tabs.flatMap(tab => tab instanceof SplitTabComponent ? tab.getAllTabs() : [tab])
}

/**
 * The split tab `tab` is a pane of, or null when it is a top-level tab.
 *
 * Needed because focusing a pane is a two-step move — select the parent split
 * on the AppService, then move focus *inside* it with `SplitTabComponent.focus()`
 * — and `getAllOpenTabs()` deliberately drops the parent link.
 */
export function findParentSplit (app: AppService, tab: BaseTabComponent): SplitTabComponent|null {
    for (const candidate of app.tabs) {
        if (candidate instanceof SplitTabComponent && candidate.getAllTabs().includes(tab)) {
            return candidate
        }
    }
    return null
}

/**
 * Moves both the app-level tab selection and, for a pane, the focus inside its
 * split — `app.selectTab()` alone would surface the split with whichever pane
 * it last had focused, which is not necessarily the one asked for.
 */
export function focusTab (app: AppService, tab: BaseTabComponent): void {
    const split = findParentSplit(app, tab)
    if (split) {
        app.selectTab(split)
        split.focus(tab)
    } else {
        app.selectTab(tab)
    }
}
