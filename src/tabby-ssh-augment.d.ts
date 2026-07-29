// tabby-ssh's published npm typings export `SFTPSession`, `SFTPFile` and
// `SFTPPanelComponent` from their index, but NOT `SSHTabComponent` — it is
// marked `@hidden`, which only affects generated docs, never real exports
// (piège #13). It *is* in the installed app's compiled webpack export block,
// verified in
// C:\Program Files\Tabby\resources\builtin-plugins\tabby-ssh\dist\index.js
// (exports: AutoPrivateKeyLocator, PasswordStorageService, PortForwardType,
// SFTPContextMenuItemProvider, SFTPPanelComponent, SFTPSession,
// SSHAlgorithmType, SSHMultiplexerService, SSHProfileImporter,
// SSHTabComponent). Declaring it here keeps the `instanceof` narrowing honest
// instead of duck-typing on the presence of an `sshSession` field, which
// would also match any other tab that happens to carry one.
//
// `SSHSession` itself is deliberately NOT named here: it is absent from that
// same runtime export block, and re-declaring the class would produce a type
// structurally incompatible with the real one (its many `private` members
// make it nominally distinct), so it could never be assigned to
// `SFTPPanelComponent.session`. Borrowing that member's type through an
// indexed access gives the genuine type without importing it.
//
// It is declared as extending `BaseTabComponent` (which the real one does,
// through ConnectableTerminalTabComponent) rather than as a bare class: an
// SSH tab has to stay assignable wherever a tab is expected, and that is also
// where `title` comes from. `BaseTabComponent` is abstract but declares no
// abstract members, so extending it here costs nothing.
import { BaseTabComponent } from 'tabby-core'
import { SFTPPanelComponent } from 'tabby-ssh'

declare module 'tabby-ssh' {
    export class SSHTabComponent extends BaseTabComponent {
        /**
         * The live SSH transport — this is what `SFTPPanelComponent.session`
         * expects. Distinct from `SSHTabComponent.session`, which is the
         * `SSHShellSession` driving the terminal frontend and carries no
         * `openSFTP()`.
         */
        sshSession: SFTPPanelComponent['session']|null
    }
}
