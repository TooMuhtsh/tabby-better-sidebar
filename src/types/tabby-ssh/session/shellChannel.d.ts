import type { Channel } from 'russh';
export declare const DEFAULT_SSH_TERMINAL_TYPE = "xterm-256color";
export interface SSHShellChannelOptions {
    x11: boolean;
    term: string | null | undefined;
}
interface SSHShellProfile {
    options: {
        x11: boolean;
        term?: string | null;
    };
}
interface SSHShellChannelOpener<T> {
    openShellChannel: (options: SSHShellChannelOptions) => Promise<T>;
}
export declare function resolveSSHTerminalType(term: unknown): string;
export declare function openShellChannelForProfile<T>(ssh: SSHShellChannelOpener<T>, profile: SSHShellProfile): Promise<T>;
export declare function requestShellPTY(channel: Pick<Channel, 'requestPTY'>, options: Pick<SSHShellChannelOptions, 'term'>): Promise<void>;
export {};
