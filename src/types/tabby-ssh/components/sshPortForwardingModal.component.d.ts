import { NotificationsService, TranslateService } from 'tabby-core';
import { SSHSession } from '../session/ssh';
import { ForwardedPortConfig } from '../api';
/** @hidden */
export declare class SSHPortForwardingModalComponent {
    private notifications;
    private translate;
    session: SSHSession;
    constructor(notifications: NotificationsService, translate: TranslateService);
    onForwardAdded(fw: ForwardedPortConfig): Promise<void>;
    onForwardRemoved(fwConfig: ForwardedPortConfig): Promise<void>;
}
