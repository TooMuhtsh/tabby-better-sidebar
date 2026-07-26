import { ApplicationRef, ComponentRef, EnvironmentInjector, Injectable, createComponent } from '@angular/core'
import { AppService, ConfigService } from 'tabby-core'
import { SidebarPlusTreeComponent } from './components/sidebarTree.component'

@Injectable({ providedIn: 'root' })
export class SidebarPlusMountService {
    private componentRef: ComponentRef<SidebarPlusTreeComponent>|null = null

    constructor (
        private appRef: ApplicationRef,
        private environmentInjector: EnvironmentInjector,
        private app: AppService,
        private config: ConfigService,
    ) {
        this.app.ready$.subscribe(() => {
            this.sync()
            this.config.changed$.subscribe(() => this.sync())
        })
    }

    private sync (): void {
        if (this.config.store.sidebarPlus?.enabled ?? true) {
            this.mount()
        } else {
            this.unmount()
        }
    }

    private mount (): void {
        if (this.componentRef) {
            return
        }
        const container = document.querySelector('.window.h-100.d-flex')
        if (!container) {
            return
        }
        this.componentRef = createComponent(SidebarPlusTreeComponent, {
            environmentInjector: this.environmentInjector,
        })
        this.appRef.attachView(this.componentRef.hostView)
        const rootNode = (this.componentRef.hostView as any).rootNodes[0] as HTMLElement
        container.insertBefore(rootNode, container.firstChild)
    }

    private unmount (): void {
        if (!this.componentRef) {
            return
        }
        this.appRef.detachView(this.componentRef.hostView)
        this.componentRef.destroy()
        this.componentRef = null
    }
}
