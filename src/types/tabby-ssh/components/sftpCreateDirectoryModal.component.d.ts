import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BaseComponent } from 'tabby-core';
/** @hidden */
export declare class SFTPCreateDirectoryModalComponent extends BaseComponent {
    private modalInstance;
    directoryName: string;
    constructor(modalInstance: NgbActiveModal);
    create(): void;
    cancel(): void;
}
