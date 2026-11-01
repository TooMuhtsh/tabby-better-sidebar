# Changelog

All notable changes to `tabby-better-sidebar` are documented here, one entry
per npm release. Dates are the npm publication dates.

## 1.0.10 (2026-11-01)

- **Changed**: the search now matches the exact text by default, whatever
  the case, in the name, description, host and user (#19). Profiles found by
  their name come first. Searching "prod" no longer finds a profile whose
  name merely has those letters in order, far apart.
- **Added**: an "Approximate search" setting under "Filter bar"
  (`searchFuzzy`, off by default) that brings back the former matching.
- **Fixed**: typing fast then clearing the filter could let an older search
  land after the newer one and show stale results.
- **Added**: the "Wrap long names" setting now offers three choices: one
  line, up to two lines, or no line limit (#18, `wrapNamesUnlimited`). A
  config that had `wrapNames` on keeps two lines.
- **Fixed**: every config save redrew all the rows of the tree. Rows are now
  kept, along with the scroll position, when a profile is edited (#17).
- **Changed**: the Features settings page shows one card per feature, on two
  columns when the page is wide, with a "By category / Simple list" switch.
  The General tab uses cards too.

## 1.0.9 (2026-10-19)

- **Added**: launch a search result from the keyboard (#15). While a search
  is typed in the filter field, the first result is highlighted and Up and
  Down move the highlight. Enter opens the highlighted profile in a new tab,
  Shift+Enter in a new pane of the active tab, next to the focused pane.
- **Added**: two settings under "Filter bar" in the Features tab. The side
  of the new pane (`searchSplitSide`, right by default), and whether the
  search is cleared after a launch (`searchClearOnLaunch`, off by default).
  When it is kept, the filter field gets the focus back.
- **Fixed**: saving the config during a search (accepting a host key,
  toggling a favorite) replaced the results with the whole tree while the
  text stayed in the field.

## 1.0.8 (2026-10-17)

- **Fixed**: on macOS with the "thin" window frame, the window buttons no
  longer cover the top of the sidebar (#13). A strip as tall as the tab bar
  now sits above it, and the window can be dragged from it. Not tested on a
  Mac yet.
- **Changed**: profiles are indented one more step inside their folder, so
  their icon lines up with the subfolders instead of the folder itself (#14).

## 1.0.7 (2026-10-09)

- **Added**: Alt+B shows or hides the sidebar (#12). Hiding does not tear it
  down: open SFTP views, the filter and the selection are still there when it
  comes back, and its background polling pauses meanwhile. The state is kept
  per machine. Not Ctrl+B, which is tmux's prefix; rebind it in Settings →
  Hotkeys if you want. The "Filter the profiles" hotkey (Ctrl+F) and switching
  the plugin back on also bring the sidebar back.
- **Added**: an "Active" tab at the head of the workspace bar (#8). It narrows
  the selected workspace to the profiles that have an open tab (disconnected
  ones included), with the folders leading to them shown open; on "All", or
  with the workspaces switched off, it shows every open session. Can be
  switched off with `showActiveToggle`.
- **Added**: `wrapNames` setting, off by default: long names wrap onto two
  lines instead of being cut short (#10).
- **Fixed**: dragging a subfolder was still possible during a search.

## 1.0.6 (2026-10-08)

- **Added**: sort the SFTP listing by name, date or size: click a column
  header (a second click reverses the order), or use the new "Sort by" section
  of the display menu. Folders stay first; the choice is remembered
  (`sftpSortKey`, `sftpSortDescending`). Contributed by @OGKaktus (#5).
- **Added**: favorite folders in the SFTP browser, saved per profile: a star
  in the toolbar adds, lists and removes them (`sftpFavorites`). A
  quick-connect session has none. Contributed by @OGKaktus (#7).
- **Added**: date format setting for the SFTP listing: follow Tabby's
  language (default, unchanged), day/month/year, or ISO 8601; the two fixed
  formats show the time in 24-hour format in the tooltip (`sftpDateFormat`,
  #11).
- **Added**: a "Collapse all / Expand all" button in the filter bar, also on
  the right click of the tree's empty space (#9).
- **Added**: the full name as a tooltip on profile rows whose name is cut short
  (#10).
- **Fixed**: toasts, dialogs and captions that were still hard-coded in French
  (remote editing, drag-out, editor picker, transfers, hotkey captions, snippet
  variables) now follow Tabby's language. Contributed by @OGKaktus (#6).
- **Fixed**: the collapsed state of the "Pinned" group was not restored after a
  restart.

## 1.0.5 — 2026-09-24

- **Added**: Simplified Chinese (`zh-CN`) translation of the whole plugin.
- **Fixed**: the column and display toggles in the SFTP header menu did not
  respond to a real mouse click.
- **Fixed**: an Angular `NG0100` error when the SFTP view closes itself.
- **Changed**: opening the SFTP view with no SSH session now shows the
  "Waiting for an active SSH session" placeholder instead of bouncing straight
  back to the profiles; the automatic return only happens when a session that
  was shown is lost.
- **Fixed**: no more false console warning about the SFTP context menu when
  Tabby runs in German, Spanish or Chinese.

## 1.0.4 — 2026-09-24

- **Fixed** (Tabby 1.0.236 compatibility): sharing a folder through the
  clipboard now keeps the three SSH options Tabby 1.0.236 introduced —
  `term`, `rememberCwd` and `cwd` (remote start directory). They used to be
  dropped as unknown options. *Copy without credentials* still removes `cwd`,
  like the username: a path such as `/home/alice/deploy` names the account and
  the server layout.
- Checked against the rest of Tabby 1.0.236 (including its Electron 38 → 43
  upgrade): no other change affects the plugin.
- **Fixed** (packaging): `typings` now points to `dist/src/index.d.ts`, where
  the build actually writes them. 1.0.3 also shipped an outdated second copy
  under `dist/`, left over from an earlier build.

## 1.0.3 — 2026-08-14

- **Security**: bumped bundled `dompurify` to 3.4.13 (GHSA-55q2-fjhq-7xh7 — the
  plugin never used the vulnerable configuration, the bump is precautionary),
  along with build-tooling dependency fixes (`nanoid`, `fast-uri`,
  `brace-expansion`). No dependency ranges changed.
- **Fixed**: the "N disallowed element(s) removed" warning shown when pasting a
  custom SVG icon now appears as a toast. It used to be a line inside the icon
  picker modal, which closes the moment the icon is applied — taking the
  message with it before it could be read.
- **Added**: this changelog, shipped with the package and back-filled for all
  previous releases.

## 1.0.2 — 2026-08-10

- **Changed**: expanded npm keywords from 6 to 29 (`sftp-client`, `ssh-tunnel`,
  `drag-and-drop`, `workspaces`, `better-tabby`…) so the package surfaces on
  relevant npm searches. No code change.

## 1.0.1 — 2026-08-09

- **Fixed**: `THIRD-PARTY-NOTICES.md` now ships with the npm package (the
  redistributed dashboard-icons logos and DOMPurify are Apache-2.0 licensed,
  which requires the notice to reach the recipient). The dashboard-icons
  section now also states which parts of the files were modified during
  vendoring. No code change.

## 1.0.0 — 2026-08-09

First stable release.

- **Added**: service logos from dashboard-icons as a third icon source
  (2 468 icons with per-icon variants, loaded on first search).
- **Added**: `Manage` / `More` submenus in the folder and profile context
  menus — the first level keeps only frequent actions.
- **Changed**: form-bearing popups (profile tunnels, icon picker) became
  centered modals.
- **Added**: i18n completed (fr/es/de, 414 keys) — error messages from the
  pure modules included.
- **Security**: hardened pasted-folder import — per-profile-type option
  whitelist, `local` profiles rejected, icon sanitised on paste.
- **Added**: footer links to the repository and author profile; settings
  header aligned with Better Vault.
- **Changed**: README rewritten as a complete feature inventory with a
  settings reference; French translation added.

## 0.4.0 — 2026-08-08

- **Added**: full sidebar i18n (fr/es/de) — profile tree, transfers block and
  settings tab (English is the source language and fallback).
- **Fixed**: the sidebar footer can no longer be overlapped by content and is
  opaque in every theme, vibrancy included.

## 0.3.0 — 2026-08-08

Everything built between the two publications — the plugin's core grew here:

- **Added**: contextual SFTP browser inside the sidebar (native panel
  subclassed: configurable columns, remote editing with your own editor,
  rename, delete with confirmation, symlink-aware editing).
- **Added**: transfer manager (timestamped list, interruption states,
  arrival check, drag-out to the OS with drop-marker delivery, internal
  move by drag & drop).
- **Added**: workspaces (per-workspace visibility, favorites and ordering,
  JSON export/import, per-workspace icons and colors).
- **Added**: active sessions block (one line per pane, focus on click,
  session-state tracking with reconnect grace) and SSH tunnels block with
  outage memory.
- **Added**: quick snippets with profile → folder → root inheritance,
  profile notes, group sharing via clipboard (secrets purged), recent
  profiles history, icon favorites.
- **Added**: per-block feature switches (each switch stops the underlying
  work, not just the view), two-tab settings page, host-compatibility
  preconditions at startup, `Ctrl+Enter` newline hotkey.
- **Added**: partial i18n (SFTP browser and modals, fr/es/de).

## 0.2.0 — 2026-07-26

Initial npm release.

- Pinned favorites, live connection status, full drag & drop (profiles and
  folders, re-parenting included), context-menu management (rename, delete
  with confirmation, profile editing via the native modal), custom icons
  (FontAwesome + offline Iconify collections + sanitised custom SVG import),
  folder/profile creation from the sidebar, resize handle, filter bar.
