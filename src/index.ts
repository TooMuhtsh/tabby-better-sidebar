import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { DragDropModule } from '@angular/cdk/drag-drop'
import TabbyCoreModule, { ConfigProvider, HotkeyProvider } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

import { SidebarPlusTreeComponent } from './components/sidebarTree.component'
import { SidebarPlusSftpComponent } from './components/sftpPanel.component'
import { SidebarPlusSftpBrowserComponent } from './components/sftpBrowser.component'
import { ConfirmModalComponent } from './components/confirmModal.component'
import { SidebarPlusSettingsTabComponent } from './components/settingsTab.component'
import { SidebarPlusConfigProvider } from './configProvider'
import { SidebarPlusSettingsTabProvider } from './settings'
import { SidebarPlusMountService } from './mount.service'
import { SidebarPlusHotkeyProvider, SidebarPlusHotkeyService } from './hotkeys'
import { SidebarPlusTempFilesService } from './tempFiles.service'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        DragDropModule,
        TabbyCoreModule,
    ],
    providers: [
        { provide: ConfigProvider, useClass: SidebarPlusConfigProvider, multi: true },
        { provide: SettingsTabProvider, useClass: SidebarPlusSettingsTabProvider, multi: true },
        { provide: HotkeyProvider, useClass: SidebarPlusHotkeyProvider, multi: true },
    ],
    declarations: [
        SidebarPlusTreeComponent,
        SidebarPlusSftpComponent,
        SidebarPlusSftpBrowserComponent,
        ConfirmModalComponent,
        SidebarPlusSettingsTabComponent,
    ],
})
export default class SidebarPlusModule {
    // These services are injected only to be instantiated: Angular never
    // constructs a `providedIn: 'root'` service nobody asks for, and each one
    // does its work from its constructor — mounting the sidebar, subscribing to
    // the hotkey stream, purging what earlier runs left in the temp directory.
    //
    // The last one is why this list matters: it was reached only through the
    // SFTP panel at first, so its startup purge ran when the panel was opened,
    // which is exactly never for a session that leaves stale copies behind.
    constructor (
        mount: SidebarPlusMountService,
        hotkeys: SidebarPlusHotkeyService,
        temp: SidebarPlusTempFilesService,
    ) {
        void mount
        void hotkeys
        void temp
    }
}
