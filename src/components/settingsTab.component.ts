import './settingsTab.component.scss'
import { Component, HostBinding, NgZone } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { SidebarPlusEditorService } from '../editorLauncher.service'

/**
 * The plugin's page in Tabby's settings.
 *
 * Holds the remote-file editor for now — the roadmap asks for the path to be
 * reviewable without waiting for a double-click to raise the picker. Any future
 * plugin-wide option belongs here rather than in the SFTP header menu, which is
 * scoped to that panel's display.
 */
@Component({
    template: require('./settingsTab.component.pug'),
})
export class SidebarPlusSettingsTabComponent {
    /** Tabby's own settings pages carry it — it is what gives the page its padding and max width. */
    @HostBinding('class.content-box') contentBox = true

    editorPath: string

    constructor (
        private editors: SidebarPlusEditorService,
        private config: ConfigService,
        private zone: NgZone,
    ) {
        this.editorPath = this.editors.editorPath
    }

    get dragOutFolders (): boolean {
        return !!this.config.store.sidebarPlus?.sftpDragOutFolders
    }

    async setDragOutFolders (value: boolean): Promise<void> {
        this.config.store.sidebarPlus.sftpDragOutFolders = value
        await this.config.save()
    }

    get deleteDefaultButton (): string {
        return this.config.store.sidebarPlus?.sftpDeleteDefaultButton ?? 'cancel'
    }

    async setDeleteDefaultButton (value: string): Promise<void> {
        this.config.store.sidebarPlus.sftpDeleteDefaultButton = value
        await this.config.save()
    }

    get hideNativeTransfersMenu (): boolean {
        return this.config.store.sidebarPlus?.hideNativeTransfersMenu ?? true
    }

    /**
     * No repaint to force here: the class on `body` is applied by
     * SidebarPlusMountService, which is already listening to `config.changed$`.
     */
    async setHideNativeTransfersMenu (value: boolean): Promise<void> {
        this.config.store.sidebarPlus.hideNativeTransfersMenu = value
        await this.config.save()
    }

    get autoRefreshSeconds (): number {
        return Number(this.config.store.sidebarPlus?.sftpAutoRefreshSeconds ?? 0)
    }

    /** Clamped to whole seconds and never negative; 0 is the documented "off". */
    async setAutoRefreshSeconds (value: unknown): Promise<void> {
        const seconds = Math.max(0, Math.round(Number(value) || 0))
        this.config.store.sidebarPlus.sftpAutoRefreshSeconds = seconds
        await this.config.save()
    }

    get pingIntervalSeconds (): number {
        return Number(this.config.store.sidebarPlus?.pingIntervalSeconds ?? 0)
    }

    /** Same clamping as the auto-refresh above: whole seconds, never negative, 0 being the documented "off". */
    async setPingIntervalSeconds (value: unknown): Promise<void> {
        const seconds = Math.max(0, Math.round(Number(value) || 0))
        this.config.store.sidebarPlus.pingIntervalSeconds = seconds
        await this.config.save()
    }

    async save (): Promise<void> {
        await this.editors.setEditorPath(this.editorPath.trim())
    }

    /**
     * `zone.run()` around the state change, not around the await: the picker
     * resolves outside Angular's zone, so assigning `editorPath` on the way
     * back updates the field without repainting it (piège #41).
     */
    async browse (): Promise<void> {
        const picked = await this.editors.pickEditorPath()
        if (!picked) {
            return
        }
        await this.editors.setEditorPath(picked)
        this.zone.run(() => {
            this.editorPath = picked
        })
    }

    async clear (): Promise<void> {
        this.editorPath = ''
        await this.editors.setEditorPath('')
    }

    get canOpenWith (): boolean {
        return this.editors.canOpenWith
    }
}
