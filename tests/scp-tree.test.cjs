/* node --test tests/scp-tree.test.cjs; only TypeScript and local test fixtures required. */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')
const Module = require('node:module')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const cache = new Map()
function load (relative, mocks = {}) {
    const filename = path.join(root, relative)
    if (!Object.keys(mocks).length && cache.has(filename)) { return cache.get(filename) }
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }, reportDiagnostics: true,
    })
    assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
    const mod = new Module(filename, module)
    mod.filename = filename
    mod.paths = Module._nodeModulePaths(path.dirname(filename))
    const req = mod.require.bind(mod)
    mod.require = name => {
        if (Object.hasOwn(mocks, name)) { return mocks[name] }
        const candidate = path.resolve(path.dirname(filename), name) + '.ts'
        return name.startsWith('.') && fs.existsSync(candidate) ? load(path.relative(root, candidate)) : req(name)
    }
    mod._compile(result.outputText, filename)
    if (!Object.keys(mocks).length) { cache.set(filename, mod.exports) }
    return mod.exports
}
const protocol = load('src/scp/protocol.ts')
const tree = load('src/scp/tree.ts')
const hasShell = spawnSync('sh', ['-c', 'exit 0']).status === 0
const shellTest = (name, run) => test(name, { skip: !hasShell }, run)
const signal = () => new AbortController().signal
const noop = () => {}
class Event {
    observers = new Set()
    subscribe (observer) { this.observers.add(observer); return { unsubscribe: () => this.observers.delete(observer) } }
    emit (value) { for (const observer of [...this.observers]) { observer.next?.(value) } }
}
class Channel {
    data$ = new Event(); extendedData$ = new Event(); eof$ = new Event(); closed$ = new Event()
    async requestExec (command) { await this.onExec?.(command) }
    async write (data) { await this.onWrite?.(Buffer.from(data)) }
    async close () { this.closed = true }
    data (data) { this.data$.emit(Buffer.from(data)) }
}

/** Local shell commands plus a simulated legacy SCP peer; no network or SFTP. */
function peer () {
    const commands = [], channels = []
    const open = async (command, abort) => {
        commands.push(command)
        const channel = new Channel()
        channels.push(channel)
        if (/^scp -[ft] /.test(command)) {
            const file = execFileSync('sh', ['-c', 'printf %s ' + command.slice(7)], { encoding: 'utf8' })
            if (command.startsWith('scp -f ')) {
                let step = 0
                channel.onWrite = () => {
                    if (++step === 1) {
                        const data = fs.readFileSync(file)
                        channel.payload = data
                        channel.data(`C0600 ${data.length} ${path.basename(file)}\n`)
                    } else if (step === 2) {
                        channel.data(channel.payload)
                        channel.data([0])
                    }
                }
            } else {
                let size = null, chunks = [], received = 0
                channel.onExec = () => channel.data([0])
                channel.onWrite = data => {
                    if (size === null) {
                        const header = /^C[0-7]{4} ([0-9]+) (.+)\n$/.exec(data.toString())
                        assert.ok(header)
                        size = Number(header[1]); channel.data([0])
                    } else if (received < size) {
                        received += data.length; chunks.push(data)
                        assert.ok(received <= size)
                    } else {
                        assert.deepEqual(data, Buffer.from([0]))
                        fs.writeFileSync(file, Buffer.concat(chunks), { mode: 0o600 })
                        channel.data([0])
                    }
                }
            }
        } else {
            channel.onExec = () => {
                const result = spawnSync('sh', ['-c', command])
                if (result.error) { throw result.error }
                if (result.stderr.length) { channel.extendedData$.emit([1, result.stderr]) }
                channel.data(result.stdout); channel.eof$.emit()
            }
        }
        const stream = new protocol.ScpStream(channel, abort, 2000)
        await stream.exec(command)
        return stream
    }
    return { open, commands, channels }
}
function fixture (t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scp-tree-test-'))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    const local = path.join(dir, 'local'), remote = path.join(dir, 'remote'), out = path.join(dir, 'out')
    for (const name of [local, remote, out]) { fs.mkdirSync(name) }
    return { dir, local, remote, out, ...peer() }
}
function write (base, name, data = 'content') {
    const file = path.join(base, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, data)
}
function snapshot (base) {
    const result = {}
    const walk = (dir, prefix) => {
        for (const name of fs.readdirSync(dir).sort()) {
            const full = path.join(dir, name), relative = prefix + name, stat = fs.lstatSync(full)
            if (stat.isSymbolicLink()) { continue }
            if (stat.isDirectory()) { result[relative + '/'] = null; walk(full, relative + '/') }
            else { result[relative] = fs.readFileSync(full).toString('hex') }
        }
    }
    walk(base, '')
    return result
}
function assertClosed (channels) {
    for (const channel of channels) {
        assert.ok(channel.closed)
        for (const event of [channel.data$, channel.extendedData$, channel.eof$, channel.closed$]) { assert.equal(event.observers.size, 0) }
    }
}

shellTest('recursive upload and download preserve nested, empty, hidden, binary and quoted names', async t => {
    const f = fixture(t), source = path.join(f.local, "project's folder")
    fs.mkdirSync(path.join(source, 'empty'), { recursive: true })
    write(source, '.hidden', 'secret'); write(source, 'nested/deeper/é漢字.bin', Buffer.from([0, 255, 128, 10]))
    write(source, 'nested/zero', ''); write(source, '$(touch NOPE)', 'literal')
    const progress = []
    const uploaded = await tree.uploadDirectory(f.open, source, f.remote, signal(), (d, n) => progress.push(d / n))
    assert.deepEqual(snapshot(uploaded.destination), snapshot(source))
    assert.equal(uploaded.files, 4); assert.equal(uploaded.directories, 4)
    assert.deepEqual(uploaded.skipped, [])
    assert.equal(progress.at(-1), 1)
    assert.ok(progress.every((p, i) => p >= 0 && p <= 1 && (!i || p >= progress[i - 1])))
    const downloaded = await tree.downloadDirectory(f.open, uploaded.destination, f.out, signal(), noop)
    assert.deepEqual(snapshot(downloaded.destination), snapshot(source))
    assertClosed(f.channels)
    assert.ok(f.commands.some(cmd => cmd.startsWith('scp -t ')))
    assert.ok(f.commands.some(cmd => cmd.startsWith('scp -f ')))
})
shellTest('recursive download includes every entry beyond Chromium 100-entry batches', async t => {
    const f = fixture(t), source = path.join(f.remote, 'many')
    for (let i = 0; i < 125; i++) { write(source, `file-${i}`, String(i)) }
    const result = await tree.downloadDirectory(f.open, source, f.out, signal(), noop)
    assert.equal(result.files, 125)
    assert.deepEqual(snapshot(result.destination), snapshot(source))
})
shellTest('empty folder trees transfer in both directions', async t => {
    const f = fixture(t), source = path.join(f.local, 'empty')
    fs.mkdirSync(path.join(source, '.hidden', 'nested'), { recursive: true })
    const up = await tree.uploadDirectory(f.open, source, f.remote, signal(), noop)
    const down = await tree.downloadDirectory(f.open, up.destination, f.out, signal(), noop)
    assert.equal(down.files, 0); assert.equal(down.directories, 3)
    assert.deepEqual(snapshot(down.destination), snapshot(source))
})
shellTest('download collision reserves a new folder and preserves existing data', async t => {
    const f = fixture(t), source = path.join(f.remote, 'project')
    write(source, 'file', 'new'); write(f.out, 'project/file', 'old'); write(f.out, 'project (2)/other', 'keep')
    const result = await tree.downloadDirectory(f.open, source, f.out, signal(), noop)
    assert.equal(path.basename(result.destination), 'project (3)')
    assert.equal(fs.readFileSync(path.join(f.out, 'project/file'), 'utf8'), 'old')
    assert.equal(fs.readFileSync(path.join(result.destination, 'file'), 'utf8'), 'new')
})
shellTest('remote upload merges directories without deleting unrelated files', async t => {
    const f = fixture(t), source = path.join(f.local, 'project')
    write(source, 'file', 'replacement'); write(f.remote, 'project/file', 'old'); write(f.remote, 'project/unrelated', 'keep')
    await tree.uploadDirectory(f.open, source, f.remote, signal(), noop)
    assert.equal(fs.readFileSync(path.join(f.remote, 'project/file'), 'utf8'), 'replacement')
    assert.equal(fs.readFileSync(path.join(f.remote, 'project/unrelated'), 'utf8'), 'keep')
})
shellTest('recursive walks skip symbolic links and loops and report every skipped entry', async t => {
    const f = fixture(t), source = path.join(f.local, 'project')
    write(source, 'file'); fs.symlinkSync(source, path.join(source, 'loop')); fs.symlinkSync('file', path.join(source, 'file-link'))
    const up = await tree.uploadDirectory(f.open, source, f.remote, signal(), noop)
    assert.equal(up.skipped.length, 2); assert.deepEqual(fs.readdirSync(up.destination), ['file'])
    fs.symlinkSync(up.destination, path.join(up.destination, 'loop'))
    fs.symlinkSync('absent', path.join(up.destination, 'broken'))
    fs.symlinkSync('file', path.join(up.destination, 'file-link'))
    const down = await tree.downloadDirectory(f.open, up.destination, f.out, signal(), noop)
    assert.equal(down.skipped.length, 3); assert.deepEqual(fs.readdirSync(down.destination), ['file'])
})
shellTest('symbolic link roots and remote directory conflicts are rejected', async t => {
    const f = fixture(t), source = path.join(f.local, 'project')
    write(source, 'file'); fs.symlinkSync(source, path.join(f.local, 'link'))
    await assert.rejects(tree.uploadDirectory(f.open, path.join(f.local, 'link'), f.remote, signal(), noop), /regular directory/)
    fs.symlinkSync(source, path.join(f.remote, 'link'))
    await assert.rejects(tree.downloadDirectory(f.open, path.join(f.remote, 'link'), f.out, signal(), noop))
    write(f.remote, 'project', 'not a directory')
    await assert.rejects(tree.uploadDirectory(f.open, source, f.remote, signal(), noop), /conflict/)
    assert.equal(fs.readFileSync(path.join(f.remote, 'project'), 'utf8'), 'not a directory')
    fs.unlinkSync(path.join(f.remote, 'project')); fs.symlinkSync(f.out, path.join(f.remote, 'project'))
    await assert.rejects(tree.uploadDirectory(f.open, source, f.remote, signal(), noop), /conflict/)
    assert.deepEqual(fs.readdirSync(f.out), [])
})
shellTest('pre-cancelled transfer opens no channel and creates no folder', async t => {
    const f = fixture(t), abort = new AbortController(); abort.abort()
    await assert.rejects(tree.uploadDirectory(f.open, f.local, f.remote, abort.signal, noop), /cancelled/)
    await assert.rejects(tree.downloadDirectory(f.open, f.remote, f.out, abort.signal, noop), /cancelled/)
    assert.equal(f.commands.length, 0); assert.deepEqual(fs.readdirSync(f.out), [])
})
shellTest('cancellation during download cleans the new tree and preserves an existing folder', async t => {
    const f = fixture(t), source = path.join(f.remote, 'project'), abort = new AbortController()
    write(source, 'a', 'a'); write(source, 'b', 'b'); write(f.out, 'project/old', 'keep')
    await assert.rejects(tree.downloadDirectory(f.open, source, f.out, abort.signal, (done) => { if (done >= 1) { abort.abort() } }), /cancelled/)
    assert.deepEqual(fs.readdirSync(f.out), ['project'])
    assert.equal(fs.readFileSync(path.join(f.out, 'project/old'), 'utf8'), 'keep')
    assertClosed(f.channels)
})
shellTest('failed payload download removes its fresh folder', async t => {
    const f = fixture(t), source = path.join(f.remote, 'project')
    write(source, 'file')
    const fail = (command, sig) => command.startsWith('scp -f ') ? Promise.reject(new Error('test disconnect')) : f.open(command, sig)
    await assert.rejects(tree.downloadDirectory(fail, source, f.out, signal(), noop), /test disconnect/)
    assert.deepEqual(fs.readdirSync(f.out), [])
})
shellTest('partial folder upload reports its destination and preserves unrelated data', async t => {
    const f = fixture(t), source = path.join(f.local, 'project')
    write(source, 'a', 'a'); write(source, 'b', 'b'); write(f.remote, 'project/keep', 'keep')
    let sent = 0
    const fail = (command, sig) => command.startsWith('scp -t ') && ++sent === 2 ? Promise.reject(new Error('test disconnect')) : f.open(command, sig)
    await assert.rejects(tree.uploadDirectory(fail, source, f.remote, signal(), noop), /Folder upload is partial/)
    assert.equal(fs.readFileSync(path.join(f.remote, 'project/a'), 'utf8'), 'a')
    assert.equal(fs.readFileSync(path.join(f.remote, 'project/keep'), 'utf8'), 'keep')
})
shellTest('unsafe tree filename is rejected during preflight before local writes', async t => {
    const f = fixture(t), source = path.join(f.remote, 'project')
    write(source, 'bad\nname')
    await assert.rejects(tree.downloadDirectory(f.open, source, f.out, signal(), noop), /safely/)
    assert.deepEqual(fs.readdirSync(f.out), [])
})
shellTest('depth limit prevents runaway trees before upload writes', async t => {
    const f = fixture(t), source = path.join(f.local, 'project')
    fs.mkdirSync(path.join(source, ...Array(65).fill('d')), { recursive: true })
    await assert.rejects(tree.uploadDirectory(f.open, source, f.remote, signal(), noop), /limit/)
    assert.equal(f.commands.length, 0)
})
for (const name of ['../escape', 'a/b', 'a\\b', 'bad\nname', '.', '..', '']) {
    test('reject unsafe local component ' + JSON.stringify(name), () => assert.throws(() => tree.localName(name, 'linux')))
}
for (const name of ['CON', 'nul.txt', 'COM1.log', 'LPT9', 'AUX ', 'a:b', 'a*', 'file.', 'file ', 'a\x01b']) {
    test('reject unsafe Windows component ' + JSON.stringify(name), () => assert.throws(() => tree.localName(name, 'win32')))
}
test('case and Unicode normalization collisions use the same local key', () => {
    assert.equal(tree.localKey('FILE', 'win32'), tree.localKey('file', 'win32'))
    assert.equal(tree.localKey('é', 'darwin'), tree.localKey('e\u0301', 'darwin'))
    assert.notEqual(tree.localKey('FILE', 'linux'), tree.localKey('file', 'linux'))
})
test('component exposes folder upload, folder download and inbound drop', () => {
    const source = fs.readFileSync(path.join(root, 'src/scp/scpPanel.component.ts'), 'utf8')
    assert.match(source, /upload\(true\)/)
    assert.match(source, /\*ngIf="row.kind !== 'x'"/)
    assert.match(source, /\(drop\)="drop\(\$event, row\)"/)
    assert.match(source, /downloadDirectory\(open/)
    assert.match(source, /uploadDirectory\(open/)
})
test('new folder labels are available in Italian', () => {
    const text = load('src/scp/messages.ts').scpMessages('it-IT')
    assert.equal(text.uploadFolder, 'Carica cartella')
    assert.match(text.confirm, /cartelle/)
    assert.match(text.skipped, /saltati/)
})
test('no SFTP calls or spawned process dependencies in production transfer code', () => {
    for (const file of fs.readdirSync(path.join(root, 'src/scp')).filter(name => name.endsWith('.ts'))) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/scp', file), 'utf8'), /\.openSFTP\s*\(|\.sftp\s*\(|from ['"]child_process|require\(['"]child_process/)
    }
})

class Subscriptions { add () {} unsubscribe () {} }
function componentFixture (dialog = null, tabs = []) {
    const app = { tabs, activeTab: tabs[0] || null, tabsChanged$: new Event() }
    const config = { store: { sidebarPlusScp: { enabled: false } }, save: async () => {}, changed$: new Event() }
    const { SidebarPlusScpComponent } = load('src/scp/scpPanel.component.ts', {
        '@angular/core': { Component: () => target => target, NgZone: class {} },
        'tabby-core': { SplitTabComponent: class {}, AppService: class {}, ConfigService: class {}, LocaleService: class {} },
        'rxjs': { Subscription: Subscriptions },
        '../tabs': { getAllOpenTabs: () => app.tabs, isSSHTab: tab => !!tab, isLiveSSHTab: tab => !!tab?.live },
        '../electronRemote': { electronRemote: () => dialog ? { dialog } : null },
    })
    const component = new SidebarPlusScpComponent(app, config, { getLocale: () => 'it-IT', localeChanged$: new Event() }, { run: fn => fn() })
    return { component, config, app }
}
function componentTransfer (component, f) {
    component.directory = f.remote
    component.selected = {}
    component.run = async work => {
        const abort = new AbortController()
        component.operation = abort
        try { await work(f.open, abort.signal, noop) } finally { component.operation = null }
    }
}
test('disabled SCP panel makes no remote calls', () => {
    const { component } = componentFixture(null, [{ live: true, sshSession: {} }])
    let navigated = false
    component.navigate = async () => { navigated = true }
    component.sync()
    assert.equal(navigated, false); assert.equal(component.selected, null)
})
test('checkbox persists; disabling aborts the active operation', async () => {
    const tab = { live: true, sshSession: {} }, { component, config } = componentFixture(null, [tab])
    component.navigate = async () => {}
    await component.setEnabled(true)
    assert.equal(config.store.sidebarPlusScp.enabled, true); assert.equal(component.selected, tab)
    const abort = new AbortController(); component.operation = abort
    await component.setEnabled(false)
    assert.equal(abort.signal.aborted, true); assert.equal(component.selected, null)
})
test('reconnect and component destruction invalidate pending transfers', () => {
    const tab = { live: true, sshSession: {} }, { component, config } = componentFixture(null, [tab])
    component.navigate = async () => {}; config.store.sidebarPlusScp.enabled = true; component.sync()
    const old = new AbortController(); component.operation = old; tab.sshSession = {}; component.sync()
    assert.equal(old.signal.aborted, true)
    const current = new AbortController(); component.operation = current; component.ngOnDestroy()
    assert.equal(current.signal.aborted, true); assert.equal(component.current(current.signal), false)
})
shellTest('Upload folder dialog invokes recursive upload after explicit confirmation', async t => {
    const f = fixture(t), source = path.join(f.local, 'project'); write(source, 'sub/file')
    let options, confirmation
    const { component } = componentFixture({
        showOpenDialog: async o => { options = o; return { canceled: false, filePaths: [source] } },
        showMessageBox: async o => { confirmation = o; return { response: 1 } },
    })
    componentTransfer(component, f)
    await component.upload(true)
    assert.ok(options.properties.includes('openDirectory'))
    assert.equal(confirmation.detail, path.join(f.remote, 'project'))
    assert.deepEqual(snapshot(path.join(f.remote, 'project')), snapshot(source))
})
shellTest('folder download button uses directory selection and recursive downloader', async t => {
    const f = fixture(t); write(f.remote, 'project/sub/file')
    let options
    const { component } = componentFixture({ showOpenDialog: async o => { options = o; return { canceled: false, filePaths: [f.out] } } })
    componentTransfer(component, f)
    await component.download({ kind: 'd', name: 'project', supported: true })
    assert.ok(options.properties.includes('openDirectory'))
    assert.deepEqual(snapshot(path.join(f.out, 'project')), snapshot(path.join(f.remote, 'project')))
})
shellTest('declining upload confirmation sends nothing', async t => {
    const f = fixture(t), source = path.join(f.local, 'project'); write(source, 'file')
    const { component } = componentFixture({ showMessageBox: async () => ({ response: 0 }) })
    componentTransfer(component, f)
    await component.upload(false, [source])
    assert.equal(f.commands.length, 0)
})
shellTest('duplicate upload basenames fail before any remote command', async t => {
    const f = fixture(t); write(f.local, 'a/file'); write(f.local, 'b/file')
    const { component } = componentFixture({})
    componentTransfer(component, f)
    await assert.rejects(component.upload(false, [path.join(f.local, 'a/file'), path.join(f.local, 'b/file')]), /destination name/)
    assert.equal(f.commands.length, 0)
})
test('drop resolves modern Electron paths and targets the folder row', async t => {
    const previous = global.window
    global.window = { require: () => ({ webUtils: { getPathForFile: file => file.nativePath } }) }
    t.after(() => { if (previous === undefined) { delete global.window } else { global.window = previous } })
    const { component } = componentFixture(); component.directory = '/remote'
    let received
    component.upload = async (...args) => { received = args }
    const local = path.resolve('local-folder')
    const event = { preventDefault () {}, stopPropagation () {}, dataTransfer: { files: [{ nativePath: local }] } }
    await component.drop(event, { name: 'subdir', kind: 'd', supported: true })
    assert.deepEqual(received, [false, [local], '/remote/subdir'])
})
test('drop refuses an incomplete native path list instead of silently losing entries', async t => {
    const previous = global.window; global.window = { require: () => ({}) }
    t.after(() => { if (previous === undefined) { delete global.window } else { global.window = previous } })
    const { component } = componentFixture(); component.directory = '/remote'
    let uploaded = false; component.upload = async () => { uploaded = true }
    await component.drop({ preventDefault () {}, stopPropagation () {}, dataTransfer: { files: [{ path: path.resolve('one') }, {}] } })
    assert.equal(uploaded, false); assert.match(component.error, /dropped paths/)
})
test('busy dragover blocks browser navigation and does not start a transfer', () => {
    const { component } = componentFixture(); component.busy = true; component.directory = '/remote'
    let prevented = false
    const event = { preventDefault () { prevented = true }, stopPropagation () {}, dataTransfer: { types: ['Files'], dropEffect: '' } }
    component.dragOver(event)
    assert.equal(prevented, true); assert.equal(event.dataTransfer.dropEffect, 'none')
})
