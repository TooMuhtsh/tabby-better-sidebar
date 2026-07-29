/// <reference types="node" />
import { Socket } from 'net';
import { ForwardedPortConfig, PortForwardType } from '../api';
export declare class ForwardedPort implements ForwardedPortConfig {
    type: PortForwardType;
    host: string;
    port: number;
    targetAddress: string;
    targetPort: number;
    description: string;
    private listener;
    startLocalListener(callback: (accept: () => Socket, reject: () => void, sourceAddress: string | null, sourcePort: number | null, targetAddress: string, targetPort: number) => void): Promise<void>;
    stopLocalListener(): void;
    toString(): string;
}
