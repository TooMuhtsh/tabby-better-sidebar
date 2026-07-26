import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import TabbyCoreModule, { ConfigProvider } from 'tabby-core'

import { SidebarPlusTreeComponent } from './components/sidebarTree.component'
import { SidebarPlusConfigProvider } from './configProvider'
import { SidebarPlusMountService } from './mount.service'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        TabbyCoreModule,
    ],
    providers: [
        { provide: ConfigProvider, useClass: SidebarPlusConfigProvider, multi: true },
    ],
    declarations: [
        SidebarPlusTreeComponent,
    ],
})
export default class SidebarPlusModule {
    constructor (mount: SidebarPlusMountService) {
        void mount
    }
}
