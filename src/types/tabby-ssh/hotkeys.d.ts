import { HotkeyDescription, HotkeyProvider, TranslateService } from 'tabby-core';
/** @hidden */
export declare class SSHHotkeyProvider extends HotkeyProvider {
    private translate;
    hotkeys: HotkeyDescription[];
    constructor(translate: TranslateService);
    provide(): Promise<HotkeyDescription[]>;
}
