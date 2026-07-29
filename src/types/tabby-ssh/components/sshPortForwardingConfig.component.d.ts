import { EventEmitter } from '@angular/core';
import { ForwardedPortConfig, PortForwardType } from '../api';
/** @hidden */
export declare class SSHPortForwardingConfigComponent {
    model: ForwardedPortConfig[];
    forwardAdded: EventEmitter<ForwardedPortConfig>;
    forwardRemoved: EventEmitter<ForwardedPortConfig>;
    newForward: ForwardedPortConfig;
    PortForwardType: typeof PortForwardType;
    constructor();
    reset(): void;
    addForward(): Promise<void>;
    remove(fw: ForwardedPortConfig): void;
}
