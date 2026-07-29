import { MenuItemOptions } from 'tabby-core';
import { SFTPFile } from '../session/sftp';
import { SFTPPanelComponent } from '../components/sftpPanel.component';
/**
 * Extend to add items to the SFTPPanel context menu
 */
export declare abstract class SFTPContextMenuItemProvider {
    weight: number;
    abstract getItems(item: SFTPFile, panel: SFTPPanelComponent): Promise<MenuItemOptions[]>;
}
