import { SSHSession } from '../session/ssh';
import { ForwardedPortConfig } from '../api';
/** @hidden */
export declare class SSHPortForwardingModalComponent {
    session: SSHSession;
    onForwardAdded(fw: ForwardedPortConfig): void;
    onForwardRemoved(fw: ForwardedPortConfig): void;
}
