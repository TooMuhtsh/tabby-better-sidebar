import { BaseTabComponent, TabContextMenuItemProvider, HostAppService, MenuItemOptions, TranslateService } from 'tabby-core';
import { SSHService } from './services/ssh.service';
/** @hidden */
export declare class SFTPContextMenu extends TabContextMenuItemProvider {
    private hostApp;
    private ssh;
    private translate;
    weight: number;
    constructor(hostApp: HostAppService, ssh: SSHService, translate: TranslateService);
    getItems(tab: BaseTabComponent): Promise<MenuItemOptions[]>;
}
