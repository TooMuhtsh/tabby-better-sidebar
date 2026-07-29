import { SSHProfile } from '../api';
import { PartialProfile, ProfilesService } from 'tabby-core';
import { SSHSession } from '../session/ssh';
export declare class SSHMultiplexerService {
    private profilesService;
    private sessions;
    constructor(profilesService: ProfilesService);
    addSession(session: SSHSession): Promise<void>;
    getSession(profile: PartialProfile<SSHProfile>): Promise<SSHSession | null>;
    private getMultiplexerKey;
}
