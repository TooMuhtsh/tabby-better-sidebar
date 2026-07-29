import { ConfigProvider } from 'tabby-core';
/** @hidden */
export declare class SSHConfigProvider extends ConfigProvider {
    defaults: {
        ssh: {
            warnOnClose: boolean;
            winSCPPath: null;
            agentType: string;
            agentPath: null;
            x11Display: null;
            knownHosts: never[];
            verifyHostKeys: boolean;
        };
        hotkeys: {
            'restart-ssh-session': never[];
            'launch-winscp': never[];
            'open-sftp': never[];
        };
    };
    platformDefaults: {};
}
