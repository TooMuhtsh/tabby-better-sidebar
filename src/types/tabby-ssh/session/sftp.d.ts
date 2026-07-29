import { Observable } from 'rxjs';
import { Injector } from '@angular/core';
import { FileDownload, FileUpload } from 'tabby-core';
import * as russh from 'russh';
export interface SFTPFile {
    name: string;
    fullPath: string;
    isDirectory: boolean;
    isSymlink: boolean;
    mode: number;
    size: number;
    modified: Date;
}
export declare class SFTPFileHandle {
    private inner;
    position: number;
    constructor(inner: russh.SFTPFile | null);
    read(): Promise<Uint8Array>;
    write(chunk: Uint8Array): Promise<void>;
    close(): Promise<void>;
}
export declare class SFTPSession {
    private sftp;
    get closed$(): Observable<void>;
    private closed;
    private logger;
    constructor(sftp: russh.SFTP, injector: Injector);
    readdir(p: string): Promise<SFTPFile[]>;
    readlink(p: string): Promise<string>;
    stat(p: string): Promise<SFTPFile>;
    open(p: string, mode: number): Promise<SFTPFileHandle>;
    rmdir(p: string): Promise<void>;
    mkdir(p: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    unlink(p: string): Promise<void>;
    chmod(p: string, mode: string | number): Promise<void>;
    upload(path: string, transfer: FileUpload): Promise<void>;
    download(path: string, transfer: FileDownload): Promise<void>;
    private _makeFile;
}
