import { ForwardedPortConfig, PortForwardType } from 'tabby-ssh'

/**
 * Formatted here rather than through `ForwardedPort.toString()`: inheriting a
 * display helper from Tabby also inherits whatever it gets wrong, and a wrong
 * rendering raises no error (piège #35). The shapes follow ssh(1)'s own
 * -L/-R/-D notation, which is what anyone reading a tunnel list expects.
 *
 * Shared between the tree's own "Tunnels actifs" section
 * (sidebarTree.component.ts) and the tunnel editor (tunnelsModal.component.ts)
 * — pulled out of the tree component so the modal does not have to import it
 * just to reach this.
 */
export function formatTunnel (forward: ForwardedPortConfig): string {
    if (forward.type === PortForwardType.Dynamic) {
        return `D ${forward.host}:${forward.port} (SOCKS)`
    }
    const arrow = forward.type === PortForwardType.Remote ? 'R' : 'L'
    return `${arrow} ${forward.host}:${forward.port} → ${forward.targetAddress}:${forward.targetPort}`
}

/**
 * Identity of a forward across the config/live boundary. The two sides are
 * different objects — Tabby's live session builds its own `ForwardedPort`
 * from the config values — so they can only be matched on what they
 * describe. `description` is left out: it is a label, editing it does not
 * make it a different tunnel.
 */
export function tunnelKey (forward: ForwardedPortConfig): string {
    return [forward.type, forward.host, forward.port, forward.targetAddress, forward.targetPort].join('|')
}
