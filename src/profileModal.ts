import { reflectComponentType } from '@angular/core'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { PartialProfile, Profile, ProfileProvider } from 'tabby-core'
import { EditProfileModalComponent } from 'tabby-settings'

/**
 * The one place this plugin hands a profile to Tabby's own edit modal.
 *
 * Two callers used to open it and assign its two inputs by hand — "Nouveau
 * profil…" and "Éditer…". Both were correct, and neither could be checked:
 * `src/tabby-settings-augment.d.ts` declares those field names because the
 * published typings are a version behind, so TypeScript takes the plugin's word
 * for it. Angular takes it too — assigning an unknown property to an instance
 * is perfectly legal. A Tabby release that renamed either field would compile
 * clean here and open an empty modal there, with nothing logged on the way.
 *
 * Naming them once is what makes the failure checkable: the list below is both
 * what `openProfileModal()` assigns and what the precondition verifies, so the
 * two cannot drift apart.
 *
 * **This does not make the plugin compatible with a Tabby that renamed them.**
 * It turns "empty modal, no explanation" into a message at startup and a refusal
 * to open — the same trade `hostCompat.ts` makes for the couplings it covers.
 */

/**
 * The inputs assigned in `openProfileModal()`, spelled once.
 *
 * `satisfies` ties the list to the augmentation: renaming a field there without
 * renaming it here stops compiling. That proves nothing about *Tabby* — the
 * augmentation is precisely what lies — but it does keep this file honest with
 * itself.
 */
const REQUIRED_INPUTS = ['partialProfile', 'profileProvider'] as const satisfies readonly (keyof EditProfileModalComponent)[]

export type ProfileModalVerdict =
    /** Both inputs are there under the names this file assigns. */
    |'ok'
    /** Angular would not say — never treated as a failure. */
    |'unknown'
    /** Angular listed the component's inputs, and at least one of ours is gone. */
    |'missing'

/** Shown to the user when the modal is refused. */
export const PROFILE_MODAL_UNAVAILABLE = 'La fenêtre de profil de Tabby a changé — création et édition de profils indisponibles sur cette version'

/**
 * Only a verdict that settles the question is kept.
 *
 * `unknown` is deliberately not cached: it means the answer could not be had
 * *yet*, and the first call runs at `app.ready$`, before any modal has ever been
 * opened. Caching it would freeze a "we could not tell" into a permanent one.
 */
let cachedVerdict: ProfileModalVerdict|null = null

/**
 * Asks Angular what inputs the host's modal actually declares.
 *
 * `reflectComponentType()` is public API (`@publicApi`, since 14.1), which the
 * `ɵcmp.inputs` route this was first sketched as is not — reading a `ɵ`-prefixed
 * field to guard against an unstable field would have shared the nature of the
 * thing it guards. Verified at both levels the way piège #13 requires: declared
 * in the npm typings of Angular 15.2.10, and present as an exported
 * `function reflectComponentType` in the bundle Tabby actually loads.
 *
 * **Read `propName`, never `templateName`** — and do not take Angular's own
 * documentation for it, whose example has the two the wrong way round. The
 * implementation (`toRefArray` over the table `invertObject` built) puts the
 * property name in `propName` and the public name in `templateName`, and the
 * distinction is the whole point here: the modal declares
 * `@Input('profile') partialProfile`, so it is `profile` that keys the raw
 * table. A check written against `templateName` — or against `ɵcmp.inputs`
 * directly — would look for `partialProfile` where the string `profile` sits,
 * and would have failed on a perfectly healthy Tabby, every single start.
 * Measured on the installed app: `[['partialProfile', 'profile'],
 * ['profileProvider', 'profileProvider'], …]`.
 */
export function checkProfileModalInputs (): ProfileModalVerdict {
    if (cachedVerdict && cachedVerdict !== 'unknown') {
        return cachedVerdict
    }
    cachedVerdict = computeVerdict()
    return cachedVerdict
}

function computeVerdict (): ProfileModalVerdict {
    // The class itself missing is `hostCompat`'s `edit-profile-modal`
    // precondition to report, not this one's. Nothing can be said about the
    // fields of a component that is not there.
    if (typeof EditProfileModalComponent !== 'function') {
        return 'unknown'
    }

    let inputs: readonly { propName: string }[]
    try {
        // JIT installs `ɵcmp` as a lazy getter, so this can be the call that
        // compiles the component. Harmless here — Tabby's build replaces
        // `templateUrl` with an inline `template`, so there is no unresolved
        // resource to throw over — but caught anyway: a precondition that
        // throws must not take the startup path down with it.
        const mirror = reflectComponentType(EditProfileModalComponent)
        if (!mirror) {
            return 'unknown'
        }
        inputs = mirror.inputs
    } catch {
        return 'unknown'
    }

    const declared = new Set(inputs.map(i => i.propName))
    const absent = REQUIRED_INPUTS.filter(name => !declared.has(name))
    if (!absent.length) {
        return 'ok'
    }
    // The list of what *is* declared is the useful half: it is what tells a
    // rename from a removal, and it is not obtainable after the fact.
    console.error(
        '[tabby-better-sidebar] EditProfileModalComponent ne déclare plus :',
        absent.join(', '),
        '— entrées réellement déclarées :',
        inputs.map(i => i.propName).join(', '),
    )
    return 'missing'
}

/**
 * Opens the host's profile modal, or refuses to.
 *
 * Refusing is the point: an empty modal is a dead end the user cannot read,
 * while `null` here becomes a message that names what happened. Only a settled
 * `missing` refuses — an `unknown` verdict opens, because "Angular would not
 * say" is not evidence of anything and the modal very probably works.
 *
 * This is the same call `tabby-core` makes for the native profile sidebar
 * (`profileTree.component.ts`, `editProfile()`) and `tabby-settings` for its own
 * list. Not a contract — none of it is exported — but a rename would break Tabby
 * in two of its own plugins first.
 */
export function openProfileModal (
    ngbModal: NgbModal,
    partialProfile: PartialProfile<Profile>,
    provider: ProfileProvider<Profile>,
): NgbModalRef|null {
    if (typeof EditProfileModalComponent !== 'function' || checkProfileModalInputs() === 'missing') {
        return null
    }
    const modal = ngbModal.open(EditProfileModalComponent, { size: 'lg' })
    modal.componentInstance.partialProfile = partialProfile
    modal.componentInstance.profileProvider = provider
    return modal
}
