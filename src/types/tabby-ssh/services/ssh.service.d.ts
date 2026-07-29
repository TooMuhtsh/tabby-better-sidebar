import * as tmp from 'tmp-promise';
import { SSHSession } from '../session/ssh';
import { SSHProfile } from '../api';
export declare class SSHService {
    private passwordStorage;
    private config;
    private platform;
    private fileProviders;
    private detectedWinSCPPath;
    private constructor();
    getWinSCPPath(): string | undefined;
    generateWinSCPXTunnelURI(jumpHostProfile: SSHProfile | null): Promise<{
        uri: string | null;
        privateKeyFile?: tmp.FileResult | null;
    }>;
    getWinSCPURI(profile: SSHProfile, cwd?: string, username?: string): Promise<{
        uri: string;
        privateKeyFile?: tmp.FileResult | null;
    }>;
    convertPrivateKeyFileToPuTTYFormat(profile: SSHProfile): Promise<{
        passphrase: string | null;
        privateKeyFile: tmp.FileResult | null;
    }>;
    launchWinSCP(session: SSHSession): Promise<void>;
}
