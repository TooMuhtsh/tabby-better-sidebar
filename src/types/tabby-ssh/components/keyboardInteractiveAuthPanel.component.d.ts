import { EventEmitter, ElementRef, OnInit, ChangeDetectorRef } from '@angular/core';
import { PlatformService } from 'tabby-core';
import { KeyboardInteractivePrompt } from '../session/ssh';
import { SSHProfile } from '../api';
import { PasswordStorageService } from '../services/passwordStorage.service';
interface PromptPart {
    text: string;
    url?: string;
}
export declare class KeyboardInteractiveAuthComponent implements OnInit {
    private passwordStorage;
    private platform;
    private cdr;
    profile: SSHProfile;
    prompt: KeyboardInteractivePrompt;
    step: number;
    done: EventEmitter<any>;
    input: ElementRef;
    remember: boolean;
    constructor(passwordStorage: PasswordStorageService, platform: PlatformService, cdr: ChangeDetectorRef);
    ngOnInit(): Promise<void>;
    isPassword(): boolean;
    shouldEcho(): boolean;
    getPromptParts(): PromptPart[];
    parsePromptText(text: string): PromptPart[];
    openPromptLink(url: string | undefined, event: Event): void;
    previous(): void;
    next(): void;
    private isPromptUrl;
}
export {};
