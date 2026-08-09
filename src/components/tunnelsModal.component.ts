import './tunnelsModal.component.scss'
import { Component, Input } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, NotificationsService, PartialProfile, Profile, ProfilesService } from 'tabby-core'
import { ForwardedPortConfig, PortForwardType } from 'tabby-ssh'
import { formatTunnel } from '../tunnels'
import { SidebarPlusI18nService } from '../i18n'

/**
 * The tunnel form's working copy. Ports are nullable here where
 * `ForwardedPortConfig` types them as `number`: a numeric input bound to 0
 * renders a literal "0" the user has to clear before typing, so the draft
 * starts empty and only becomes a ForwardedPortConfig once validated.
 */
interface TunnelDraft {
    type: PortForwardType
    host: string
    port: number|null
    targetAddress: string
    targetPort: number|null
    description: string
}

function emptyTunnel (): TunnelDraft {
    return {
        type: PortForwardType.Local,
        // Hosts keep a sensible default — they are almost always these —
        // while both ports start empty rather than at 0, which would have to
        // be cleared by hand before typing.
        host: '127.0.0.1',
        port: null,
        targetAddress: 'localhost',
        targetPort: null,
        description: '',
    }
}

/**
 * The plugin's own tunnel editor, and — by the user's explicit choice — the
 * only one. An entry handing over to Tabby's native `showPortForwarding()`
 * modal was built and validated alongside it, then dropped: "je veux
 * uniquement ma solution maison".
 *
 * A modal rather than the popup this started as, for the same reason as the
 * snippets and note editors: a form is a poor fit for a 300px box anchored to
 * the cursor. It used to carry its own positioning, screen-edge clamp and
 * click-outside exception — the last one because it is the only popup that
 * could lose a half-filled form to a stray click — all three of which a
 * centred modal makes moot (NgbModal already blocks clicks outside its own
 * backdrop from reaching the page, and never closes on Escape while a text
 * field would eat it first).
 *
 * What that settles, so it is not rediscovered as a bug: nothing here can
 * touch a session that is already running. Everything written goes to the
 * profile's configuration, which Tabby reads only when a session starts.
 * Acting on a live session would mean calling `SSHSession.addPortForward()`,
 * which calls `fw.startLocalListener()` and therefore needs a genuine
 * `ForwardedPort` — a class tabby-ssh does not export at runtime (checked
 * against the installed bundle, piège #13). Rebuilding one from an existing
 * forward's prototype would only work once the user already had a tunnel,
 * which is circular.
 */
@Component({
    selector: 'sidebar-plus-tunnels-modal',
    template: require('./tunnelsModal.component.pug'),
})
export class TunnelsModalComponent {
    @Input() profile!: PartialProfile<Profile>
    /**
     * Whether a given forward is one Tabby currently has mounted — decides if
     * its deletion is withheld. A callback rather than a one-time snapshot:
     * the tree recomputes this on the same 2s poll that drives its own
     * "Tunnels actifs" section, and a session can open or close while this
     * modal is sitting open.
     */
    @Input() isLive: (forward: ForwardedPortConfig) => boolean = () => false
    /** Whether `profile` has a live session right now — only used to decide whether the "takes effect at next launch" notice is worth showing. */
    @Input() hasLiveSession: () => boolean = () => false

    tunnelDraft: TunnelDraft = emptyTunnel()
    tunnelError: string|null = null
    /** Index of the tunnel the form is editing, or null when it is adding a new one. */
    editingTunnelIndex: number|null = null

    constructor (
        private profilesService: ProfilesService,
        private config: ConfigService,
        private notifications: NotificationsService,
        private modalInstance: NgbActiveModal,
        private i18n: SidebarPlusI18nService,
    ) { }

    /** Tunnels stored on the profile itself. */
    get profileTunnels (): ForwardedPortConfig[] {
        return (this.profile.options as { forwardedPorts?: ForwardedPortConfig[] }|undefined)?.forwardedPorts ?? []
    }

    get tunnelTypes (): PortForwardType[] {
        return [PortForwardType.Local, PortForwardType.Remote, PortForwardType.Dynamic]
    }

    formatTunnelRow (forward: ForwardedPortConfig): string {
        return formatTunnel(forward)
    }

    /**
     * Loads an existing tunnel back into the form (double-click on its row).
     * Ports come back as null when zero so the field reads empty rather than
     * "0" — same reason the draft keeps them nullable in the first place; a
     * Dynamic forward is stored with an empty destination, and editing one
     * should not show a phantom port.
     */
    startEditTunnel (index: number): void {
        const forward = this.profileTunnels[index]
        if (!forward) {
            return
        }
        this.tunnelDraft = {
            type: forward.type,
            host: forward.host,
            port: forward.port || null,
            targetAddress: forward.targetAddress || 'localhost',
            targetPort: forward.targetPort || null,
            description: forward.description ?? '',
        }
        this.editingTunnelIndex = index
        this.tunnelError = null
    }

    cancelEditTunnel (): void {
        this.tunnelDraft = emptyTunnel()
        this.editingTunnelIndex = null
        this.tunnelError = null
    }

    get isDynamicDraft (): boolean {
        return this.tunnelDraft.type === PortForwardType.Dynamic
    }

    /**
     * Which side of the connection each field refers to — it *inverts*
     * between Local and Remote, and the destination is always resolved from
     * the far end of the tunnel, so `localhost` means the server for a Local
     * forward. Left implicit, this is the kind of thing that gets a forward
     * pointed at the wrong machine on real infrastructure.
     */
    get tunnelHint (): string {
        if (this.tunnelDraft.type === PortForwardType.Remote) {
            return this.i18n.t('Listens on the remote server. The destination is resolved from your PC.')
        }
        if (this.tunnelDraft.type === PortForwardType.Dynamic) {
            return this.i18n.t('Opens a SOCKS proxy on your PC, with no fixed destination.')
        }
        return this.i18n.t('Listens on your PC. The destination is resolved from the server, so "localhost" there means the server.')
    }

    async addProfileTunnel (): Promise<void> {
        const draft = this.tunnelDraft
        if (!draft.port) {
            this.tunnelError = this.i18n.t('Enter a listening port.')
            return
        }
        if (!this.isDynamicDraft && (!draft.targetAddress || !draft.targetPort)) {
            this.tunnelError = this.i18n.t('Enter the destination host and port.')
            return
        }
        this.tunnelError = null

        // Dynamic forwards have no destination — Tabby still expects the
        // fields to exist, so they are written as empty/0 rather than left
        // undefined.
        const forward: ForwardedPortConfig = {
            type: draft.type,
            host: draft.host,
            port: draft.port,
            targetAddress: this.isDynamicDraft ? '' : draft.targetAddress,
            targetPort: this.isDynamicDraft ? 0 : draft.targetPort!,
            description: draft.description,
        }

        const options = (this.profile.options ??= {}) as { forwardedPorts?: ForwardedPortConfig[] }
        // Reassigned rather than pushed into: writeProfile() replaces the
        // stored profile wholesale, so what matters is that `profile` carries
        // the final array — but a fresh array also keeps the rendered list
        // from sharing structure with the draft.
        const forwards = [...(options.forwardedPorts ?? [])]
        if (this.editingTunnelIndex !== null && forwards[this.editingTunnelIndex]) {
            forwards[this.editingTunnelIndex] = forward
        } else {
            forwards.push(forward)
        }
        options.forwardedPorts = forwards
        const wasEditing = this.editingTunnelIndex !== null
        await this.profilesService.writeProfile(this.profile)
        await this.config.save()
        this.tunnelDraft = emptyTunnel()
        this.editingTunnelIndex = null

        // Said once, when it actually matters, rather than as a banner
        // sitting permanently above the form: what is written here is
        // configuration, and Tabby only reads it when a session starts.
        //
        // info() rather than notice(): the latter hard-codes `timeOut: 1000`
        // in tabby-core, a second being far too short for a sentence
        // explaining *why* nothing seems to have happened. info() leaves
        // ngx-toastr its own timeout and splits the message into title and
        // detail.
        if (this.hasLiveSession()) {
            this.notifications.info(
                wasEditing ? this.i18n.t('Tunnel updated') : this.i18n.t('Tunnel saved'),
                wasEditing
                    ? this.i18n.t('The current session keeps the old one until it is relaunched.')
                    : this.i18n.t('It will be mounted at the next launch of this session.'),
            )
        }
    }

    async removeProfileTunnel (index: number): Promise<void> {
        // Only a tunnel Tabby has actually mounted resists deletion: removing
        // its configuration would leave the forward running while the user
        // believes it gone. One merely written down — added since the
        // session started, or never launched — deletes freely. Guarded here
        // as well as in the template: the rule belongs with the data.
        const target = this.profileTunnels[index]
        if (target && this.isLive(target)) {
            this.tunnelError = this.i18n.t('This tunnel is mounted on the current session. Close the session to be able to delete it.')
            return
        }
        const options = (this.profile.options ??= {}) as { forwardedPorts?: ForwardedPortConfig[] }
        const forwards = [...(options.forwardedPorts ?? [])]
        forwards.splice(index, 1)
        options.forwardedPorts = forwards
        // A pending edit is indexed into the list that just shifted: cancel
        // it if its target is gone, and follow the shift otherwise — saving
        // against a stale index would overwrite the wrong tunnel.
        if (this.editingTunnelIndex !== null) {
            if (this.editingTunnelIndex === index) {
                this.cancelEditTunnel()
            } else if (this.editingTunnelIndex > index) {
                this.editingTunnelIndex--
            }
        }
        await this.profilesService.writeProfile(this.profile)
        await this.config.save()
    }

    close (): void {
        this.modalInstance.dismiss()
    }
}
