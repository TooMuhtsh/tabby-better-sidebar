import { Injector } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Platform, ProfilesService } from 'tabby-core';
import { ConnectableTerminalTabComponent } from 'tabby-terminal';
import { SSHService } from '../services/ssh.service';
import { KeyboardInteractivePrompt, SSHSession } from '../session/ssh';
import { SSHProfile } from '../api';
import { SSHShellSession } from '../session/shell';
import { SSHMultiplexerService } from '../services/sshMultiplexer.service';
/** @hidden */
export declare class SSHTabComponent extends ConnectableTerminalTabComponent<SSHProfile> {
    ssh: SSHService;
    private ngbModal;
    private profilesService;
    private sshMultiplexer;
    Platform: typeof Platform;
    sshSession: SSHSession | null;
    session: SSHShellSession | null;
    sftpPanelVisible: boolean;
    sftpPath: string;
    enableToolbar: boolean;
    activeKIPrompt: KeyboardInteractivePrompt | null;
    constructor(injector: Injector, ssh: SSHService, ngbModal: NgbModal, profilesService: ProfilesService, sshMultiplexer: SSHMultiplexerService);
    ngOnInit(): void;
    setupOneSession(injector: Injector, profile: SSHProfile, multiplex?: boolean): Promise<SSHSession>;
    protected onSessionDestroyed(): void;
    private initializeSessionMaybeMultiplex;
    initializeSession(): Promise<void>;
    showPortForwarding(): void;
    canClose(): Promise<boolean>;
    openSFTP(): Promise<void>;
    onClick(): void;
    protected isSessionExplicitlyTerminated(): boolean;
}
