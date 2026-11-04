import { Component, NgZone, OnDestroy, OnInit } from '@angular/core'
import { AppService, ConfigService, LocaleService, SplitTabComponent } from 'tabby-core'
import type { SSHTabComponent } from 'tabby-ssh'
import { merge, Subscription, timer } from 'rxjs'
import { promises as fs } from 'fs'
import { basename, isAbsolute, posix } from 'path'
import { electronRemote } from '../electronRemote'
import { getAllOpenTabs, isLiveSSHTab, isSSHTab } from '../tabs'
import { downloadFile, uploadFile } from './files'
import { downloadDirectory, TreeSummary, uploadDirectory } from './tree'
import { listDirectory, OpenExec, Progress, RemoteEntry, remoteFile, scpName, sessionExec } from './protocol'
import { scpMessages } from './messages'

type Session = NonNullable<SSHTabComponent['sshSession']>
interface Row extends RemoteEntry { supported: boolean }

/** Independent of SFTP; transfers stay pinned to their selected SSH session. */
@Component({
    selector: 'sidebar-plus-scp',
    template: `
        <label class="scp-toggle">
            <input type="checkbox" [ngModel]="enabled" (ngModelChange)="setEnabled($event)">
            <span>{{ text.show }}</span>
        </label>
        <section *ngIf="enabled" class="scp-panel" aria-label="SCP">
            <label class="small">{{ text.session }}
                <select class="form-control form-control-sm" [ngModel]="selected" (ngModelChange)="select($event)" [disabled]="busy">
                    <option [ngValue]="null" disabled>—</option>
                    <option *ngFor="let tab of sessions" [ngValue]="tab">{{ tab.title }}</option>
                </select>
            </label>
            <p *ngIf="!selected" class="small text-muted">{{ text.waiting }}</p>
            <ng-container *ngIf="selected">
                <form class="scp-path" (ngSubmit)="navigate(pathInput)">
                    <input class="form-control form-control-sm" name="scpPath" [(ngModel)]="pathInput" [disabled]="busy" [attr.aria-label]="text.path">
                    <button type="submit" class="btn btn-sm btn-secondary" [disabled]="busy">{{ text.go }}</button>
                </form>
                <div class="scp-actions">
                    <button type="button" class="btn btn-sm btn-secondary" (click)="parent()" [disabled]="busy || !directory" [title]="text.up">..</button>
                    <button type="button" class="btn btn-sm btn-secondary" (click)="navigate(directory || '.')" [disabled]="busy">{{ text.refresh }}</button>
                    <button type="button" class="btn btn-sm btn-secondary" (click)="upload(false)" [disabled]="busy || !directory">{{ text.upload }}</button>
                    <button type="button" class="btn btn-sm btn-secondary" (click)="upload(true)" [disabled]="busy || !directory">{{ text.uploadFolder }}</button>
                </div>
                <input class="form-control form-control-sm" [(ngModel)]="filter" (ngModelChange)="filterRows()" [placeholder]="text.filter" [attr.aria-label]="text.filter">
                <div class="scp-files" [attr.aria-busy]="busy" (dragover)="dragOver($event)" (drop)="drop($event)">
                    <div *ngFor="let row of visibleRows" class="scp-row" (dragover)="dragOver($event)" (drop)="drop($event, row)">
                        <button type="button" class="btn btn-sm scp-name" (click)="openRow(row)" [disabled]="busy || !row.supported"
                            [title]="row.supported ? row.name : text.unavailable">
                            <span class="fa fa-fw fas" [class.fa-folder]="row.kind === 'd'" [class.fa-file]="row.kind !== 'd'" aria-hidden="true"></span>
                            <span>{{ row.name }}</span>
                        </button>
                        <button *ngIf="row.kind !== 'x'" type="button" class="btn btn-sm" (click)="download(row)" [disabled]="busy || !row.supported" [title]="text.download" [attr.aria-label]="text.download">
                            <span class="fa fas fa-download" aria-hidden="true"></span>
                        </button>
                    </div>
                    <p *ngIf="!busy && !visibleRows.length" class="small text-muted">{{ text.empty }}</p>
                </div>
            </ng-container>
            <div *ngIf="busy" class="scp-status" role="status">
                {{ text.busy }} <span *ngIf="transferring">{{ percent }}%</span>
                <button type="button" class="btn btn-sm btn-secondary" (click)="cancel()">{{ text.cancel }}</button>
            </div>
            <p *ngIf="status" class="small scp-message" role="status">{{ status }}</p>
            <p *ngIf="error" class="scp-message small text-danger" role="alert">{{ error }}</p>
            <small class="text-muted">{{ text.hint }}</small>
        </section>
    `,
    styles: [`
        :host { display: block; flex-shrink: 0; margin: .35rem 0; }
        .scp-toggle, .scp-actions, .scp-path, .scp-row, .scp-status { display: flex; align-items: center; gap: .4rem; }
        .scp-toggle { cursor: pointer; margin: 0; }
        .scp-panel { max-height: 45vh; overflow: auto; margin-top: .4rem; padding: .4rem; border: 1px solid currentColor; border-radius: .25rem; }
        .scp-panel > label { display: block; }
        .scp-actions, .scp-path { margin-bottom: .4rem; }
        .scp-actions { flex-wrap: wrap; }
        .scp-path input { min-width: 0; }
        .scp-files { max-height: 30vh; min-height: 2rem; overflow: auto; margin-top: .3rem; }
        .scp-name { min-width: 0; flex: 1; display: flex; text-align: left; align-items: center; }
        .scp-name > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .scp-message { white-space: pre-wrap; overflow-wrap: anywhere; margin-top: .4rem; }
        .scp-status { flex-wrap: wrap; margin-top: .4rem; }
    `],
})
export class SidebarPlusScpComponent implements OnInit, OnDestroy {
    enabled = false
    text = scpMessages('en')
    sessions: SSHTabComponent[] = []
    selected: SSHTabComponent|null = null
    directory = ''
    pathInput = '.'
    filter = ''
    visibleRows: Row[] = []
    busy = false
    transferring = false
    percent = 0
    status = ''
    error = ''
    private rows: Row[] = []
    private session: Session|null = null
    private paths = new WeakMap<SSHTabComponent, string>()
    private operation: AbortController|null = null
    private subscription = new Subscription()
    private destroyed = false

    constructor (private app: AppService, private config: ConfigService, private locale: LocaleService, private zone: NgZone) { }

    ngOnInit (): void {
        this.text = scpMessages(this.locale.getLocale())
        this.subscription.add(this.locale.localeChanged$.subscribe(locale => { this.text = scpMessages(locale) }))
        this.subscription.add(merge(timer(0, 1000), this.app.tabsChanged$, this.config.changed$).subscribe(() => this.zone.run(() => this.sync())))
    }
    ngOnDestroy (): void {
        this.destroyed = true
        this.subscription.unsubscribe()
        this.invalidate()
    }
    async setEnabled (enabled: boolean): Promise<void> {
        const previous = this.enabled
        this.config.store.sidebarPlusScp.enabled = enabled
        this.sync()
        try { await this.config.save() } catch (error) {
            this.config.store.sidebarPlusScp.enabled = previous
            if (!this.destroyed) { this.zone.run(() => { this.sync(); this.error = String(error) }) }
        }
    }
    private sync (): void {
        this.enabled = this.config.store.sidebarPlusScp?.enabled === true
        if (!this.enabled) {
            if (this.selected || this.operation) { this.select(null) }
            this.sessions = []
            return
        }
        this.sessions = getAllOpenTabs(this.app).filter(isSSHTab).filter(isLiveSSHTab)
        if (this.selected && this.sessions.includes(this.selected)) {
            if (this.selected.sshSession !== this.session) { this.select(this.selected) }
            return
        }
        let focused = this.app.activeTab
        if (focused instanceof SplitTabComponent) { focused = focused.getFocusedTab() }
        this.select(this.sessions.find(tab => tab === focused) ?? this.sessions[0] ?? null)
    }
    select (tab: SSHTabComponent|null): void {
        this.invalidate()
        this.selected = tab
        this.session = tab?.sshSession ?? null
        this.directory = ''
        this.pathInput = tab ? this.paths.get(tab) ?? '.' : '.'
        this.rows = []
        this.visibleRows = []
        this.error = ''
        this.status = ''
        if (tab && this.enabled) { void this.navigate(this.pathInput) }
    }
    private invalidate (): void {
        this.operation?.abort()
        this.operation = null
        this.busy = false
    }
    cancel (): void { this.operation?.abort() }
    filterRows (): void {
        const filter = this.filter.toLocaleLowerCase()
        this.visibleRows = this.rows.filter(row => row.name.toLocaleLowerCase().includes(filter))
    }
    private async run (work: (open: OpenExec, signal: AbortSignal, progress: Progress) => Promise<void>): Promise<void> {
        if (this.busy || !this.enabled || !this.selected || !this.session || !isLiveSSHTab(this.selected)) { return }
        const operation = new AbortController()
        this.operation = operation
        this.busy = true
        this.transferring = false
        this.percent = 0
        this.error = ''
        this.status = ''
        try {
            await work(sessionExec(this.session), operation.signal, (done, total) => {
                if (this.operation !== operation || this.destroyed) { return }
                this.zone.run(() => { this.transferring = true; this.percent = total ? Math.min(100, Math.floor(done * 100 / total)) : 0 })
            })
        } catch (error) {
            if (this.operation === operation && !this.destroyed) {
                this.zone.run(() => { this.error = error instanceof Error ? error.message : String(error) })
            }
        } finally {
            if (this.operation === operation && !this.destroyed) {
                this.zone.run(() => { this.busy = false; this.operation = null })
            }
        }
    }
    private current (signal: AbortSignal): boolean {
        return !this.destroyed && !signal.aborted && this.operation?.signal === signal
    }
    private async refresh (open: OpenExec, path: string, signal: AbortSignal): Promise<void> {
        const listing = await listDirectory(open, path, signal)
        if (!this.current(signal)) { return }
        this.zone.run(() => {
            this.directory = listing.path
            this.pathInput = listing.path
            this.paths.set(this.selected!, listing.path)
            this.rows = listing.entries.map(row => {
                let supported = row.kind !== 'x'
                try { remoteFile(listing.path, row.name) } catch { supported = false }
                return { ...row, supported }
            })
            this.filterRows()
        })
    }
    async navigate (path: string): Promise<void> {
        await this.run((open, signal) => this.refresh(open, path, signal))
    }
    parent (): void { void this.navigate(posix.dirname(this.directory)) }
    openRow (row: Row): void {
        if (!row.supported || this.busy) { return }
        if (row.kind === 'd') { void this.navigate(remoteFile(this.directory, row.name)) }
        else { void this.download(row) }
    }
    private dialog (): any {
        const dialog = electronRemote()?.dialog
        if (!dialog) { throw new Error(this.text.missingDialog) }
        return dialog
    }
    private completed (signal: AbortSignal, summaries: TreeSummary[] = []): void {
        if (!this.current(signal)) { return }
        this.zone.run(() => {
            this.percent = 100
            const skipped = summaries.flatMap(item => item.skipped)
            this.status = [this.text.complete, ...summaries.map(item => item.destination),
                ...(skipped.length ? [this.text.skipped + ' ' + skipped.length, ...skipped.slice(0, 10), ...(skipped.length > 10 ? ['…'] : [])] : [])].join('\n')
        })
    }
    async download (row: Row): Promise<void> {
        if (!row.supported || row.kind === 'x') { return }
        const remote = remoteFile(this.directory, row.name)
        await this.run(async (open, signal, progress) => {
            const dialog = this.dialog()
            if (row.kind === 'd') {
                const result = await dialog.showOpenDialog({ title: 'SCP — ' + this.text.download, properties: ['openDirectory', 'createDirectory'] })
                if (result.canceled || !result.filePaths?.length || !this.current(signal)) { return }
                const summary = await downloadDirectory(open, remote, result.filePaths[0], signal, progress)
                this.completed(signal, [summary])
            } else {
                const suggestion = scpName(row.name).replace(/[<>:"|?*\x00-\x1f]/g, '_')
                const result = await dialog.showSaveDialog({ title: 'SCP — ' + this.text.download, defaultPath: suggestion })
                if (result.canceled || !result.filePath || !this.current(signal)) { return }
                await downloadFile(open, remote, result.filePath, signal, progress)
                this.completed(signal)
            }
        })
    }
    async upload (folder = false, dropped?: string[], targetDirectory?: string): Promise<void> {
        const directory = targetDirectory ?? this.directory
        const browsing = this.directory
        await this.run(async (open, signal, progress) => {
            const dialog = this.dialog()
            const result = dropped ? { canceled: false, filePaths: dropped } : await dialog.showOpenDialog({
                title: 'SCP — ' + (folder ? this.text.uploadFolder : this.text.upload),
                properties: [folder ? 'openDirectory' : 'openFile', 'multiSelections'],
            })
            if (result.canceled || !result.filePaths?.length || !this.current(signal)) { return }
            // Validate the entire selection before confirming or sending its first item.
            const paths: string[] = Array.from(new Set<string>(result.filePaths))
            const names = new Set<string>()
            const items: { local: string, directory: boolean, target: string }[] = []
            for (const local of paths) {
                if (!isAbsolute(local)) { throw new Error(this.text.dropUnavailable) }
                const name = basename(local)
                if (names.has(name)) { throw new Error(this.text.duplicate) }
                names.add(name)
                const stat = await fs.lstat(local)
                if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) { throw new Error(this.text.unavailable + '\n' + local) }
                items.push({ local, directory: stat.isDirectory(), target: remoteFile(directory, name) })
            }
            if (!this.current(signal)) { return }
            const confirmation = await dialog.showMessageBox({ type: 'warning', message: this.text.confirm,
                detail: items.map(item => item.target).join('\n'), buttons: [this.text.cancel, this.text.upload], defaultId: 0, cancelId: 0 })
            if (confirmation.response !== 1 || !this.current(signal)) { return }
            const summaries: TreeSummary[] = []
            for (let index = 0; index < items.length; index++) {
                const item = items[index]
                if (!this.current(signal)) { return }
                const report: Progress = (done, total) => progress(index + (total ? done / total : 0), items.length)
                if (item.directory) { summaries.push(await uploadDirectory(open, item.local, directory, signal, report)) }
                else { await uploadFile(open, item.local, directory, signal, report) }
                progress(index + 1, items.length)
            }
            await this.refresh(open, browsing, signal)
            this.completed(signal, summaries)
        })
    }
    dragOver (event: DragEvent): void {
        if (!event.dataTransfer?.types.includes('Files')) { return }
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = this.busy || !this.directory ? 'none' : 'copy'
    }
    async drop (event: DragEvent, row?: Row): Promise<void> {
        event.preventDefault()
        event.stopPropagation()
        if (this.busy || !this.directory || !event.dataTransfer?.files.length) { return }
        try {
            if (row && !row.supported) { throw new Error(this.text.unavailable) }
            const target = row?.kind === 'd' ? remoteFile(this.directory, row.name) : this.directory
            // File.path on older Electron; webUtils.getPathForFile on newer hosts.
            const req = (window as any).require ?? (global as any).require
            let webUtils: any
            try { webUtils = req?.('electron')?.webUtils } catch { /* legacy File.path remains usable */ }
            const paths = Array.from(event.dataTransfer.files).map(file => {
                const path = webUtils?.getPathForFile ? webUtils.getPathForFile(file) : (file as File & { path?: string }).path
                if (!path || !isAbsolute(path)) { throw new Error(this.text.dropUnavailable) }
                return path
            })
            await this.upload(false, paths, target)
        } catch (error) { this.zone.run(() => { this.error = String(error) }) }
    }
}
