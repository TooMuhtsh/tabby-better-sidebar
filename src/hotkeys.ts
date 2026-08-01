import { Injectable } from '@angular/core'
import { AppService, BaseTabComponent, HotkeyDescription, HotkeyProvider, HotkeysService, SplitTabComponent } from 'tabby-core'
import { BaseTerminalTabComponent } from 'tabby-terminal'

/** Id of the hotkey, shared between the provider, the defaults and the handler. */
export const INSERT_NEWLINE_HOTKEY = 'sidebar-plus-insert-newline'

/**
 * A hotkey that inserts a line break in the focused terminal.
 *
 * Why this exists at all: `Ctrl`+`Entrée` and `Entrée` are *indistinguishable*
 * once they reach the pty — xterm writes a bare CR (`^M`) for both, as
 * `Ctrl-V` in a shell shows. An application on the far end therefore cannot
 * tell them apart, whatever it does; only `Ctrl`+`J` (LF) gets through, which
 * is a poor substitute for a gesture used constantly.
 *
 * The distinction *does* still exist in the renderer, where the keyboard event
 * carries `ctrlKey`. Tabby's hotkey layer runs there, before the keystroke is
 * written to the pty — which is the one place a binding can act on it. The
 * action then writes the LF itself.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusHotkeyService {
    constructor (
        private app: AppService,
        hotkeys: HotkeysService,
    ) {
        // hotkey$, not unfilteredHotkey$: the filtered stream stays silent
        // while a text input holds the focus, so typing in the sidebar's own
        // rename/filter fields never fires this.
        hotkeys.hotkey$.subscribe(id => {
            if (id === INSERT_NEWLINE_HOTKEY) {
                this.insertNewline()
            }
        })
    }

    private insertNewline (): void {
        const tab = this.focusedTerminal()
        // No terminal in front (settings tab, an empty window…) — do nothing
        // rather than guess a target: this hotkey writes into a live session.
        tab?.sendInput('\n')
    }

    /**
     * The terminal actually in front, split panes included.
     *
     * `app.activeTab` returns the *split* for a divided tab, never the pane, so
     * the focused child has to be asked for explicitly — same two-step move as
     * `focusTab()` in `tabs.ts`.
     */
    private focusedTerminal (): BaseTerminalTabComponent<any>|null {
        const active: BaseTabComponent|null = this.app.activeTab
        const tab = active instanceof SplitTabComponent ? active.getFocusedTab() : active
        return tab instanceof BaseTerminalTabComponent ? tab : null
    }
}

export class SidebarPlusHotkeyProvider extends HotkeyProvider {
    async provide (): Promise<HotkeyDescription[]> {
        return [{
            id: INSERT_NEWLINE_HOTKEY,
            name: 'Insérer un saut de ligne (Better Sidebar)',
        }]
    }
}
