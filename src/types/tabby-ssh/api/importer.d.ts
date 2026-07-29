/// <reference types="node" />
/// <reference types="node" />
import { PartialProfile } from 'tabby-core';
import { SSHProfile } from './interfaces';
export declare abstract class SSHProfileImporter {
    abstract getProfiles(): Promise<PartialProfile<SSHProfile>[]>;
}
export declare abstract class AutoPrivateKeyLocator {
    abstract getKeys(): Promise<[string, Buffer][]>;
}
