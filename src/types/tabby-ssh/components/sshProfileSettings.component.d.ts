import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FileProvidersService, Platform, HostAppService, PartialProfile, ProfilesService, ProfileSettingsComponent, FullyDefined, ProxifiedConfig } from 'tabby-core';
import { LoginScriptsSettingsComponent } from 'tabby-terminal';
import { PasswordStorageService } from '../services/passwordStorage.service';
import { ForwardedPortConfig, SSHProfile } from '../api';
import { SSHProfilesService } from '../profiles';
/** @hidden */
export declare class SSHProfileSettingsComponent implements ProfileSettingsComponent<SSHProfile, SSHProfilesService> {
    hostApp: HostAppService;
    private profilesService;
    private passwordStorage;
    private ngbModal;
    private fileProviders;
    Platform: typeof Platform;
    profile: ProxifiedConfig<FullyDefined<SSHProfile>>;
    hasSavedPassword: boolean;
    connectionMode: 'direct' | 'proxyCommand' | 'jumpHost' | 'socksProxy' | 'httpProxy';
    supportedAlgorithms: {
        kex: string[];
        serverHostKey: string[];
        cipher: string[];
        hmac: string[];
        compression: string[];
    };
    algorithms: Record<string, Record<string, boolean>>;
    jumpHosts: PartialProfile<SSHProfile>[];
    loginScriptsSettings: LoginScriptsSettingsComponent | null;
    constructor(hostApp: HostAppService, profilesService: ProfilesService, passwordStorage: PasswordStorageService, ngbModal: NgbModal, fileProviders: FileProvidersService);
    ngOnInit(): Promise<void>;
    getJumpHostLabel(p: PartialProfile<SSHProfile>): string;
    setPassword(): Promise<void>;
    clearSavedPassword(): void;
    addPrivateKey(): Promise<void>;
    removePrivateKey(path: string): void;
    save(): void;
    onForwardAdded(fw: ForwardedPortConfig): void;
    onForwardRemoved(fw: ForwardedPortConfig): void;
    getConnectionDropdownTitle(): string;
}
