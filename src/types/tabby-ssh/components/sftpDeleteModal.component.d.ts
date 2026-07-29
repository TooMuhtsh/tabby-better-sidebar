import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BaseComponent } from 'tabby-core';
import { SFTPFile, SFTPSession } from '../session/sftp';
/** @hidden */
export declare class SFTPDeleteModalComponent extends BaseComponent {
    private modalInstance;
    sftp: SFTPSession;
    item: SFTPFile;
    progressMessage: string;
    cancelled: boolean;
    constructor(modalInstance: NgbActiveModal);
    ngOnInit(): Promise<void>;
    cancel(): void;
    run(file: SFTPFile): Promise<void>;
}
