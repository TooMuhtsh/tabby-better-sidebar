# Changelog

All notable changes to `tabby-better-sidebar` are documented here, one entry
per npm release. Dates are the npm publication dates.

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
