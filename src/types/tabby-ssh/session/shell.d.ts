/// <reference types="node" />
/// <reference types="node" />
import { Observable } from 'rxjs';
import { Injector } from '@angular/core';
import { BaseSession } from 'tabby-terminal';
import { SSHSession } from './ssh';
import { SSHProfile } from '../api';
import * as russh from 'russh';
export declare class SSHShellSession extends BaseSession {
    private profile;
    shell?: russh.Channel;
    get serviceMessage$(): Observable<string>;
    private serviceMessage;
    private ssh;
    constructor(injector: Injector, ssh: SSHSession, profile: SSHProfile);
    start(): Promise<void>;
    emitServiceMessage(msg: string): void;
    resize(columns: number, rows: number): void;
    write(data: Buffer): void;
    kill(_signal?: string): void;
    destroy(): Promise<void>;
    getChildProcesses(): Promise<any[]>;
    gracefullyKillProcess(): Promise<void>;
    supportsWorkingDirectory(): boolean;
    getWorkingDirectory(): Promise<string | null>;
}
