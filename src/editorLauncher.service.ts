import { execFile, spawn } from 'child_process'
import { existsSync } from 'fs'
import { Inject, Injectable, Optional } from '@angular/core'
import { ConfigService, FileProvider, NotificationsService } from 'tabby-core'
import { electronRemote } from './electronRemote'

/**
 * What a downloaded copy is handed to: the configured editor, or the OS's own
 * "open with" dialog when there is none.
 */
export type Opener =
    { kind: 'editor', path: string }
    /**
     * `learn` is set only when this dialog stood in for a missing editor, never
     * when the user asked for it explicitly from the context menu: that entry
     * is a one-off escape hatch and must not redefine what double-click does.
     */
    |{ kind: 'openWith', learn?: boolean }

/**
 * Where a remote file opens once it has been copied locally.
 *
 * The whole point of this service is that a double-click never hands a file to
 * the OS by association: an executable, or a script whose extension is bound to
 * an interpreter, would *run* instead of being edited. Everything that opens a
 * downloaded copy goes through `launchEditor()`, and the only way to reach the
 * OS association at all is the explicit "Ouvrir avec..." entry of the context
 * menu, which is a deliberate escape hatch and never a default.
 */
@Injectable({ providedIn: 'root' })
export class SidebarPlusEditorService {
    constructor (
        private config: ConfigService,
        private notifications: NotificationsService,
        // `@Optional()`: a multi-token with no registered provider throws on
        // injection rather than handing back an empty array, and this service
        // is a dependency of the whole SFTP browser — a Tabby build without a
        // single FileProvider would take the panel down with it instead of
        // merely losing the picker, which `pickEditorPath()` already handles.
        @Optional() @Inject(FileProvider) private fileProviders: FileProvider[]|null,
    ) { }

    get editorPath (): string {
        return this.config.store.sidebarPlus?.sftpEditorPath || ''
    }

    async setEditorPath (path: string): Promise<void> {
        this.config.store.sidebarPlus.sftpEditorPath = path
        await this.config.save()
    }

    /**
     * How a double-clicked file should be opened.
     *
     * With an editor configured, that editor — no question asked. Without one,
     * Windows' own "Ouvrir avec" dialog, which is what the user asked for: it
     * lists installed applications instead of making them find an .exe in
     * Program Files.
     *
     * That dialog cannot be remembered, and this is not an oversight:
     * `OpenAs_RunDLL` opens the file with whatever was picked and returns
     * nothing — no Windows API hands the chosen application back. So it comes
     * up on every double-click until an editor is set in the settings tab,
     * which is the one place that can record one.
     *
     * Elsewhere (no "Ouvrir avec" outside Windows) the file picker stands in,
     * and what it returns *is* recorded. Returns null when there is nothing to
     * open with — callers treat that as "open nothing", never as a licence to
     * fall back to the OS association.
     */
    async resolveOpener (): Promise<Opener|null> {
        const configured = this.editorPath
        if (configured) {
            return { kind: 'editor', path: configured }
        }
        if (this.canOpenWith) {
            return { kind: 'openWith', learn: true }
        }
        const picked = await this.pickEditorPath()
        if (!picked) {
            return null
        }
        await this.setEditorPath(picked)
        return { kind: 'editor', path: picked }
    }

    /**
     * The OS's own "choose an application" file dialog.
     *
     * Opened through `@electron/remote`, not through Tabby's own helpers, for
     * one reason: neither `FileProvider.selectAndStoreFile()` nor
     * `PlatformService.startUpload()` lets a caller set `defaultPath` or
     * `filters`, so both land wherever the OS last left the dialog — in
     * practice the Downloads folder, which is the last place an editor lives.
     * Here it opens on the platform's applications directory and filters to
     * runnable things.
     *
     * Returns null on cancel and on a dialog that could not be opened at all.
     */
    async pickEditorPath (): Promise<string|null> {
        const remote = electronRemote()
        if (!remote) {
            return this.pickEditorPathFallback()
        }
        let result: { canceled: boolean, filePaths: string[] }
        try {
            result = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
                title: 'Choisir l\'éditeur des fichiers distants',
                defaultPath: this.defaultEditorDirectory(),
                buttonLabel: 'Utiliser cet éditeur',
                filters: this.editorFilters(),
                // No `treatPackageAsDirectory`: on macOS an .app has to be
                // selectable as one item, not browsed into.
                properties: ['openFile'],
            })
        } catch (e) {
            // Resolvable but unusable — e.g. a build where the remote module is
            // not enabled for this webContents. Tabby's own picker still works
            // in that case, so this falls back rather than failing outright.
            console.warn('sidebar-plus: native file dialog unavailable, falling back', e)
            return this.pickEditorPathFallback()
        }
        if (result.canceled || !result.filePaths.length) {
            return null
        }
        return this.resolveShortcut(result.filePaths[0], remote)
    }

    /**
     * Where the dialog opens. Not the last-used directory, which is the whole
     * point — an editor is never in Downloads.
     *
     * Windows deliberately starts in Program Files rather than the Start Menu:
     * the Start Menu holds `.lnk` shortcuts, and while `resolveShortcut()`
     * below handles one, a real executable is what actually gets spawned.
     */
    private defaultEditorDirectory (): string {
        if (process.platform === 'win32') {
            return process.env.ProgramFiles || 'C:\\Program Files'
        }
        if (process.platform === 'darwin') {
            return '/Applications'
        }
        return '/usr/bin'
    }

    private editorFilters (): { name: string, extensions: string[] }[] {
        if (process.platform === 'win32') {
            return [
                { name: 'Applications', extensions: ['exe', 'com', 'bat', 'cmd', 'lnk'] },
                { name: 'Tous les fichiers', extensions: ['*'] },
            ]
        }
        if (process.platform === 'darwin') {
            return [
                { name: 'Applications', extensions: ['app'] },
                { name: 'Tous les fichiers', extensions: ['*'] },
            ]
        }
        return [{ name: 'Tous les fichiers', extensions: ['*'] }]
    }

    /**
     * A Windows `.lnk` is resolved to its target at pick time, not at launch
     * time: `spawn()` does not follow shortcuts (no shell is involved, which is
     * deliberate), and storing the real executable also means the settings tab
     * shows what will actually run.
     */
    private resolveShortcut (picked: string, remote: any): string {
        if (process.platform !== 'win32' || !picked.toLowerCase().endsWith('.lnk')) {
            return picked
        }
        try {
            const target = remote.shell.readShortcutLink(picked).target
            return target || picked
        } catch (e) {
            this.notifications.error(`Impossible de lire le raccourci ${picked}`, String(e))
            return picked
        }
    }

    /**
     * Used only when `@electron/remote` is unreachable: Tabby's `Filesystem`
     * FileProvider, which opens the same kind of native dialog but with no
     * control over where it starts.
     *
     * Not `FileProvidersService.selectAndStoreFile()`, which first asks *which*
     * storage to pick from as soon as more than one provider exists — Tabby
     * ships a second one, `VaultFileProvider`, whose result is a `vault://`
     * key, not a path this could spawn. The filesystem provider returns a
     * `file://`-prefixed path and throws on cancel.
     */
    private async pickEditorPathFallback (): Promise<string|null> {
        const provider = this.fileProviders?.find(p => p.name === 'Filesystem')
        if (!provider) {
            this.notifications.error('Aucun sélecteur de fichier disponible pour choisir un éditeur')
            return null
        }
        let key: string
        try {
            key = await provider.selectAndStoreFile('éditeur')
        } catch {
            // Cancelled — the provider throws rather than returning null.
            return null
        }
        return key.startsWith('file://') ? key.substring('file://'.length) : key
    }

    /**
     * Runs the configured editor on a local path.
     *
     * `detached` + `stdio: 'ignore'` + `unref()`: without them the editor stays
     * a child of Tabby, its pipes keep the parent's event loop referencing it,
     * and closing Tabby takes the editor down with it. Failures are reported
     * and stop there — never a fallback to the OS association, which is the
     * behaviour this whole path exists to avoid.
     */
    launchEditor (editorPath: string, localPath: string): void {
        // macOS: an .app is a bundle, not an executable — `open -a` is the
        // supported way to hand it a file. Everywhere else the picked path is
        // the program itself.
        const [command, args] = process.platform === 'darwin' && editorPath.endsWith('.app')
            ? ['open', ['-a', editorPath, localPath]]
            : [editorPath, [localPath]]
        try {
            const child = spawn(command as string, args as string[], { detached: true, stdio: 'ignore' })
            // ENOENT for a moved or uninstalled editor arrives asynchronously,
            // never as a throw from spawn() itself.
            child.on('error', e => {
                this.notifications.error(`Impossible de lancer l'éditeur ${editorPath}`, String(e))
            })
            child.unref()
        } catch (e) {
            this.notifications.error(`Impossible de lancer l'éditeur ${editorPath}`, String(e))
        }
    }

    /** Windows only — the entry that offers this is gated on the platform. */
    get canOpenWith (): boolean {
        return process.platform === 'win32'
    }

    /**
     * Windows' own "Open with..." dialog on a local path.
     *
     * `execFile`, not `exec`: no shell is involved, so a path containing a
     * space, an ampersand or a quote is passed as one argument instead of being
     * re-parsed by cmd.
     *
     * The callback fires when `rundll32` exits, which is when the dialog closes
     * and the chosen application has been started — the moment `learnFrom()`
     * needs to start looking.
     */
    openWith (localPath: string, learn = false): void {
        execFile('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', localPath], e => {
            if (e) {
                this.notifications.error(`Impossible d'ouvrir la boîte « Ouvrir avec »`, String(e))
                return
            }
            if (learn && !this.editorPath) {
                void this.learnFrom(localPath)
            }
        })
    }

    /**
     * Works out which application the "Open with" dialog started, and keeps it.
     *
     * Windows offers no way to ask: `OpenAs_RunDLL` returns nothing, and the
     * registry trail it leaves (`FileExts\<.ext>\OpenWithList`) is per
     * extension — useless for the files this actually opens, which are remote
     * config files usually named without one. What *is* reliable is that the
     * application was handed our temp path on its command line, so the process
     * list identifies it whatever its extension.
     *
     * Deliberately a single PowerShell process that does its own polling rather
     * than one spawn per attempt: an editor can take a few seconds to appear,
     * and repeatedly paying PowerShell's startup would cost more than the whole
     * lookup. Silent when nothing is found — an unmemorised editor is a dialog
     * next time, not an error.
     */
    private async learnFrom (localPath: string): Promise<void> {
        // Single-quoted PowerShell literal, with internal quotes doubled — not
        // JSON.stringify: that escapes backslashes the JSON way and PowerShell
        // does not unescape them inside a double-quoted string, so every `\`
        // of the path would be searched for as `\\`.
        const script = `
$p = '${localPath.replace(/'/g, "''")}'
for ($i = 0; $i -lt 20; $i++) {
    $m = Get-CimInstance Win32_Process |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($p) -and $_.Name -notmatch '^(rundll32|powershell|pwsh|conhost|explorer|WmiPrvSE)\\.exe$' } |
        Select-Object -First 1
    if ($m) { $m | Select-Object CommandLine, ExecutablePath | ConvertTo-Json -Compress; break }
    Start-Sleep -Milliseconds 500
}`
        const found = await new Promise<string>(resolve => {
            execFile(
                'powershell.exe',
                ['-NoProfile', '-NonInteractive', '-Command', script],
                { windowsHide: true, timeout: 20000 },
                (e, stdout) => resolve(e ? '' : stdout.trim()),
            )
        })
        if (!found) {
            return
        }

        let parsed: { CommandLine?: string, ExecutablePath?: string }
        try {
            parsed = JSON.parse(found)
        } catch {
            return
        }

        const resolvedPath = this.executableFromCommandLine(parsed.CommandLine, parsed.ExecutablePath)
        if (!resolvedPath) {
            return
        }
        await this.setEditorPath(resolvedPath)
        this.notifications.notice(`Éditeur mémorisé : ${resolvedPath} — modifiable dans Paramètres → Better Sidebar`)
    }

    /**
     * The program out of a Win32 command line.
     *
     * The quoted first token is preferred over `ExecutablePath` on purpose: for
     * a Store application the latter points inside `WindowsApps`, whose ACLs
     * usually refuse a direct spawn, while the command line carries the
     * launcher that actually works (measured on Notepad, which reports
     * `WindowsApps\...\Notepad.exe` but is launched as
     * `C:\WINDOWS\system32\notepad.exe`).
     */
    private executableFromCommandLine (commandLine?: string, executablePath?: string): string|null {
        const line = (commandLine ?? '').trim()
        if (line.startsWith('"')) {
            const end = line.indexOf('"', 1)
            if (end > 1) {
                return line.substring(1, end)
            }
        }
        // Unquoted: only safe to cut at the first space when the result really
        // is a file — an unquoted path with spaces would be truncated.
        const firstSpace = line.indexOf(' ')
        const candidate = firstSpace > 0 ? line.substring(0, firstSpace) : line
        if (candidate && existsSync(candidate)) {
            return candidate
        }
        return executablePath && existsSync(executablePath) ? executablePath : null
    }
}
