import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { DragDropModule } from '@angular/cdk/drag-drop'
import TabbyCoreModule, { ConfigProvider } from 'tabby-core'

import { SidebarPlusTreeComponent } from './components/sidebarTree.component'
import { SidebarPlusSftpComponent } from './components/sftpPanel.component'
import { SidebarPlusSftpBrowserComponent } from './components/sftpBrowser.component'
import { SidebarPlusConfigProvider } from './configProvider'
import { SidebarPlusMountService } from './mount.service'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        DragDropModule,
        TabbyCoreModule,
    ],
    providers: [
        { provide: ConfigProvider, useClass: SidebarPlusConfigProvider, multi: true },
    ],
    declarations: [
        SidebarPlusTreeComponent,
        SidebarPlusSftpComponent,
        SidebarPlusSftpBrowserComponent,
    ],
})
export default class SidebarPlusModule {
    constructor (mount: SidebarPlusMountService) {
        void mount
    }
}
