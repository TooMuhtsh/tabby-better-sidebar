import { ConfigService } from 'tabby-core';
export interface KnownHostSelector {
    host: string;
    port: number;
    type: string;
}
export interface KnownHost extends KnownHostSelector {
    digest: string;
}
export declare class SSHKnownHostsService {
    private config;
    constructor(config: ConfigService);
    getFor(selector: KnownHostSelector): KnownHost | null;
    store(selector: KnownHostSelector, digest: string): Promise<void>;
}
