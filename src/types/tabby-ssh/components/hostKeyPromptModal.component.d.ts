import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { KnownHost, KnownHostSelector, SSHKnownHostsService } from '../services/sshKnownHosts.service';
/** @hidden */
export declare class HostKeyPromptModalComponent {
    private knownHosts;
    private modalInstance;
    selector: KnownHostSelector;
    digest: string;
    knownHost: KnownHost | null;
    isMismatched: boolean;
    isUnknown: boolean;
    constructor(knownHosts: SSHKnownHostsService, modalInstance: NgbActiveModal);
    ngOnInit(): void;
    accept(): void;
    acceptAndSave(): Promise<void>;
    cancel(): void;
}
