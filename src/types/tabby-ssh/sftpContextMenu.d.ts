import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MenuItemOptions, PlatformService, TranslateService, HostAppService } from 'tabby-core';
import { SFTPSession, SFTPFile } from './session/sftp';
import { SFTPContextMenuItemProvider } from './api';
import { SFTPPanelComponent } from './components/sftpPanel.component';
/** @hidden */
export declare class CommonSFTPContextMenu extends SFTPContextMenuItemProvider {
    private platform;
    private ngbModal;
    private translate;
    private hostApp;
    weight: number;
    constructor(platform: PlatformService, ngbModal: NgbModal, translate: TranslateService, hostApp: HostAppService);
    getItems(item: SFTPFile, panel: SFTPPanelComponent): Promise<MenuItemOptions[]>;
    deleteItem(item: SFTPFile, session: SFTPSession): Promise<void>;
}
