/// <reference types="node" />
/// <reference types="node" />
import { Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { SFTPSession } from './sftp';
import { SSHProfile } from '../api';
import { ForwardedPort } from './forwards';
import * as russh from 'russh';
export interface Prompt {
    prompt: string;
    echo?: boolean;
}
export declare class KeyboardInteractivePrompt {
    name: string;
    instruction: string;
    prompts: Prompt[];
    readonly responses: string[];
    private _resolve;
    private _reject;
    readonly promise: Promise<string[]>;
    constructor(name: string, instruction: string, prompts: Prompt[]);
    isAPasswordPrompt(index: number): boolean;
    respond(): void;
    reject(): void;
}
export declare class SSHSession {
    private injector;
    profile: SSHProfile;
    shell?: russh.Channel;
    ssh: russh.SSHClient | russh.AuthenticatedSSHClient;
    sftp?: russh.SFTP;
    forwardedPorts: ForwardedPort[];
    jumpChannel: russh.NewChannel | null;
    savedPassword?: string;
    get serviceMessage$(): Observable<string>;
    get keyboardInteractivePrompt$(): Observable<KeyboardInteractivePrompt>;
    get willDestroy$(): Observable<void>;
    activePrivateKey: russh.KeyPair | null;
    authUsername: string | null;
    open: boolean;
    private logger;
    private refCount;
    private allAuthMethods;
    private serviceMessage;
    private keyboardInteractivePrompt;
    private willDestroy;
    private passwordStorage;
    private ngbModal;
    private hostApp;
    private notifications;
    private fileProviders;
    private config;
    private translate;
    private knownHosts;
    private privateKeyImporters;
    private previouslyDisconnected;
    constructor(injector: Injector, profile: SSHProfile);
    private addPublicKeyAuthMethod;
    init(): Promise<void>;
    private populateStoredPasswordsForResolvedUsername;
    private getAgentConnectionSpec;
    openSFTP(): Promise<SFTPSession>;
    start(): Promise<void>;
    private verifyHostKey;
    emitServiceMessage(msg: string): void;
    emitKeyboardInteractivePrompt(prompt: KeyboardInteractivePrompt): void;
    handleAuth(): Promise<russh.AuthenticatedSSHClient | null>;
    private _handleAuth;
    addPortForward(fw: ForwardedPort): Promise<void>;
    removePortForward(fw: ForwardedPort): Promise<void>;
    destroy(): Promise<void>;
    openShellChannel(options: {
        x11: boolean;
    }): Promise<russh.Channel>;
    private setupSocketChannelEvents;
    loadPrivateKey(name: string, privateKeyContents: Buffer): Promise<russh.KeyPair>;
    loadPrivateKeyWithPassphraseMaybe(privateKey: string): Promise<russh.KeyPair>;
    ref(): void;
    unref(): void;
}
