import { Injector } from '@angular/core';
import { NewTabParameters, PartialProfile, TranslateService, QuickConnectProfileProvider } from 'tabby-core';
import { SSHProfileSettingsComponent } from './components/sshProfileSettings.component';
import { SSHTabComponent } from './components/sshTab.component';
import { PasswordStorageService } from './services/passwordStorage.service';
import { SSHProfile } from './api';
export declare class SSHProfilesService extends QuickConnectProfileProvider<SSHProfile> {
    private passwordStorage;
    private translate;
    private injector;
    id: string;
    name: string;
    settingsComponent: typeof SSHProfileSettingsComponent;
    configDefaults: {
        options: {
            host: string;
            port: number;
            user: string;
            auth: null;
            password: null;
            privateKeys: never[];
            keepaliveInterval: number;
            keepaliveCountMax: number;
            readyTimeout: null;
            x11: boolean;
            skipBanner: boolean;
            jumpHost: null;
            agentForward: boolean;
            warnOnClose: null;
            algorithms: {
                hmac: string[];
                kex: string[];
                cipher: string[];
                serverHostKey: string[];
                compression: string[];
            };
            proxyCommand: null;
            forwardedPorts: never[];
            scripts: never[];
            socksProxyHost: null;
            socksProxyPort: null;
            httpProxyHost: null;
            httpProxyPort: null;
            reuseSession: boolean;
            input: {
                backspace: string;
            };
        };
        clearServiceMessagesOnConnect: boolean;
    };
    constructor(passwordStorage: PasswordStorageService, translate: TranslateService, injector: Injector);
    getBuiltinProfiles(): Promise<PartialProfile<SSHProfile>[]>;
    getNewTabParameters(profile: SSHProfile): Promise<NewTabParameters<SSHTabComponent>>;
    getSuggestedName(profile: SSHProfile): string;
    getDescription(profile: PartialProfile<SSHProfile>): string;
    deleteProfile(profile: SSHProfile): void;
    quickConnect(query: string): PartialProfile<SSHProfile>;
    intoQuickConnectString(profile: SSHProfile): string | null;
}
