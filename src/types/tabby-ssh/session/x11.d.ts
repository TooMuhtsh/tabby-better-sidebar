/// <reference types="node" />
import { Socket, SocketConnectOpts } from 'net';
import { Subject } from 'rxjs';
export declare class X11Socket {
    error$: Subject<Error>;
    private socket;
    static resolveDisplaySpec(spec?: string | null): SocketConnectOpts;
    connect(spec: string): Promise<Socket>;
    destroy(): void;
}
