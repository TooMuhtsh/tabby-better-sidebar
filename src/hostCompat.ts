import { SSHTabComponent, SFTPPanelComponent, SFTPSession } from 'tabby-ssh'
import { EditProfileModalComponent, SettingsTabComponent } from 'tabby-settings'
import { checkProfileModalInputs } from './profileModal'

/**
 * What this plugin needs from its host, named one by one.
 *
 * The plugin reaches into Tabby well past its public API — it subclasses
 * `SFTPPanelComponent`, narrows tabs with `instanceof SSHTabComponent`, opens
 * `EditProfileModalComponent` (which the typings do not export), and inserts
 * its own root node into a container found by CSS selector. None of that is
 * contractual, and a Tabby update can take any of it away.
 *
 * The point of this file is *not* to make the plugin survive that — it cannot.
 * It is to make the failure **say something**. Every one of these couplings
 * fails as a non-event today: a sidebar that never appears, a panel that stays
 * empty, an `instanceof` that is quietly false forever. Nothing is thrown,
 * nothing reaches the console, and the diagnosis starts from zero every time.
 *
 * Two deliberate non-goals:
 *
 * - **Not a Tabby version check.** A version number would cry wolf on a
 *   perfectly compatible release and stay silent on a fork or a local build
 *   that moved something. What is verified is the contact points themselves.
 * - **Not an all-or-nothing gate.** Each precondition names the feature it
 *   carries, so a missing `SFTPPanelComponent` costs the SFTP view and nothing
 *   else. Only `mount-container` is fatal, because without it there is no
 *   sidebar to degrade.
 */
export interface HostPrecondition {
    id: string
    /** What the user loses when this one is not met — shown to them, so in French. */
    feature: string
    /** True when the host still provides what this plugin needs. */
    check: () => boolean
    /** Whether failing this one leaves nothing worth mounting. */
    fatal?: boolean
}

/** Angular components and classes arrive as `undefined` when the host stops exporting them, never as a throw. */
const isClass = (x: unknown): boolean => typeof x === 'function'

export const HOST_PRECONDITIONS: HostPrecondition[] = [
    {
        id: 'mount-container',
        feature: 'la sidebar elle-même',
        // The one host *DOM* dependency left after the profile edit route moved
        // to the API. `SidebarPlusMountService` inserts its root node here.
        check: () => !!document.querySelector('.window.h-100.d-flex'),
        fatal: true,
    },
    {
        id: 'ssh-tab',
        feature: 'les sessions actives, le SFTP et les tunnels',
        check: () => isClass(SSHTabComponent),
    },
    {
        id: 'sftp-panel',
        feature: 'le panneau SFTP',
        check: () => isClass(SFTPPanelComponent) && isClass(SFTPSession),
    },
    {
        id: 'edit-profile-modal',
        feature: 'la création et l\'édition de profils',
        // The class being there is not enough, and this was the one red point
        // left after the 2026-08-03 pass: the two inputs the plugin assigns are
        // declared in an augmentation that lies to TypeScript by construction
        // (piège #17), so a rename in Tabby compiles clean here and opens an
        // empty modal there. `checkProfileModalInputs()` asks Angular what the
        // component really declares — and answers `unknown` rather than guess
        // when it cannot tell, which is why only a settled `missing` fails.
        check: () => isClass(EditProfileModalComponent)
            && isClass(SettingsTabComponent)
            && checkProfileModalInputs() !== 'missing',
    },
]

export interface HostCompatReport {
    failed: HostPrecondition[]
    fatal: boolean
}

/**
 * Verdict of the last `checkHost()`, so anything can ask "does the host still
 * provide this?" without re-running the checks.
 *
 * Empty until the first run, which is deliberate: before `app.ready$` the DOM
 * precondition cannot be answered honestly, and a block that asked early would
 * get a "supported" it did not earn. Every consumer runs well after.
 */
const failedIds = new Set<string>()

export function checkHost (): HostCompatReport {
    const failed = HOST_PRECONDITIONS.filter(p => {
        try {
            return !p.check()
        } catch {
            // A precondition that throws has failed, by definition — and
            // swallowing it here is the whole point: this file exists so that
            // a broken coupling is reported rather than propagated.
            return true
        }
    })
    failedIds.clear()
    failed.forEach(p => failedIds.add(p.id))
    return { failed, fatal: failed.some(p => p.fatal) }
}

/**
 * Whether the host still provides a given precondition.
 *
 * This is the junction between the two robustness mechanisms: a block switched
 * off by the user and a block the host can no longer carry both come down to
 * "do not show it, and do not feed it". The settings checkbox stays ticked in
 * the second case — the user did not untick it, and lying about their own
 * setting would be worse than a block that simply is not there.
 */
export function hostSupports (id: string): boolean {
    return !failedIds.has(id)
}

/**
 * The failure mode no static check can see: piège #34.
 *
 * When a second copy of `tabby-ssh` is loaded, its classes are homonyms of the
 * real ones but not the same objects — so `instanceof SSHTabComponent` is false
 * for a tab that plainly *is* one, every narrowing silently drops every tab,
 * and every feature keyed off SSH tabs goes blank with nothing logged. All four
 * preconditions above pass in that state, because the classes do exist; they
 * are simply the wrong ones.
 *
 * It is only observable when a real tab is in hand, so `isSSHTab()` in
 * `tabs.ts` reports it from the one place that does the narrowing.
 */
const suspected = new Set<string>()

/** Records a name/identity mismatch. Returns true the first time a given class is seen failing, so callers can warn once. */
export function noteIdentityMismatch (className: string): boolean {
    if (suspected.has(className)) {
        return false
    }
    suspected.add(className)
    return true
}

export function hasIdentityMismatch (): boolean {
    return suspected.size > 0
}
