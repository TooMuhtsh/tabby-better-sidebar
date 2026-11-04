/* Run with: node --test tests/scp.test.cjs (uses the project's TypeScript devDependency). */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')
const hasShell = spawnSync('sh', ['-c', 'exit 0']).status === 0
const Module = require('node:module')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const cache = new Map()
function load (relative, mocks = {}) {
    const filename = path.join(root, relative)
    if (!Object.keys(mocks).length && cache.has(filename)) { return cache.get(filename) }
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
        reportDiagnostics: true,
    })
    assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
    const mod = new Module(filename, module)
    mod.filename = filename
    mod.paths = Module._nodeModulePaths(path.dirname(filename))
    const originalRequire = mod.require.bind(mod)
    mod.require = name => {
        if (Object.hasOwn(mocks, name)) { return mocks[name] }
        if (name.startsWith('.')) {
            const candidate = path.resolve(path.dirname(filename), name) + '.ts'
            if (fs.existsSync(candidate)) { return load(path.relative(root, candidate)) }
        }
        return originalRequire(name)
    }
    mod._compile(result.outputText, filename)
    if (!Object.keys(mocks).length) { cache.set(filename, mod.exports) }
    return mod.exports
}
const protocol = load('src/scp/protocol.ts')
const files = load('src/scp/files.ts')
class Event {
    observers = new Set()
    subscribe (observer) { this.observers.add(observer); return { unsubscribe: () => this.observers.delete(observer) } }
    emit (value) { for (const observer of [...this.observers]) { observer.next?.(value) } }
}
class Channel {
    data$ = new Event(); extendedData$ = new Event(); eof$ = new Event(); closed$ = new Event()
    commands = []; writes = []; closed = 0
    async requestExec (command) { this.commands.push(command); this.onExec?.(command) }
    async write (data) { this.writes.push(Buffer.from(data)); this.onWrite?.(Buffer.from(data)) }
    async close () { this.closed++ }
    data (data) { this.data$.emit(Buffer.from(data)) }
    listeners () { return [this.data$, this.extendedData$, this.eof$, this.closed$].reduce((n, event) => n + event.observers.size, 0) }
}
const signal = () => new AbortController().signal
const noop = () => {}
function openChannel (channel, idle = 1000) {
    return async (command, abort) => {
        const stream = new protocol.ScpStream(channel, abort, idle)
        await stream.exec(command)
        return stream
    }
}
function sender (name, data, options = {}) {
    const channel = new Channel()
    let stage = 0
    channel.onWrite = () => {
        stage++
        if (stage === 1) {
            const header = options.header || `C0644 ${data.length} ${name}\n`
            // Deliberately fragment control records, including multibyte UTF-8 names.
            for (const byte of Buffer.from(header)) { channel.data([byte]) }
        }
        if (stage === 2) {
            for (let i = 0; i < data.length; i += 7) { channel.data(data.subarray(i, i + 7)) }
            if (options.truncated) { channel.eof$.emit() }
            else { channel.data(options.final || [0]) }
        }
    }
    return channel
}
function receiver (size, final = [0]) {
    const channel = new Channel()
    channel.onExec = () => channel.data([0])
    let header = false
    let received = 0
    channel.onWrite = data => {
        if (!header) { header = true; channel.data([0]); return }
        if (received < size) { received += data.length; return }
        channel.data(final)
    }
    return channel
}
async function * chunks (...items) { for (const item of items) { yield Buffer.from(item) } }

for (const value of ["quote's.txt", 'two words', 'é漢字', 'a;echo nope', '$(echo nope)', '-file', 'a\\b']) {
    test('POSIX quoting roundtrip: ' + value, { skip: !hasShell }, () => {
        assert.equal(execFileSync('sh', ['-c', 'printf %s ' + protocol.shellQuote(value)], { encoding: 'utf8' }), value)
    })
}
test('reject unsafe legacy SCP names and relative destinations', () => {
    for (const name of ['', '.', '..', '../escape', 'a/b', 'a\\b', 'a\nC0600 1 evil', 'a\r', 'a\0']) {
        assert.throws(() => protocol.scpName(name))
    }
    assert.throws(() => protocol.remoteFile('-option', 'file'))
    assert.equal(protocol.remoteFile('/', 'file'), '/file')
})
test('POSIX listing handles hidden files, directories, spaces, quotes and newlines', { skip: !hasShell }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scp-list-'))
    const names = ['file', '.hidden', "it's fine", 'two words', '漢字', 'line\nbreak', '$(touch MUST_NOT_EXIST)']
    try {
        names.forEach(name => fs.writeFileSync(path.join(dir, name), 'data'))
        fs.mkdirSync(path.join(dir, 'folder'))
        const output = execFileSync('sh', ['-c', protocol.listingCommand(dir)], { cwd: dir })
        const listing = protocol.parseListing(output)
        assert.equal(listing.path, dir)
        assert.deepEqual(new Set(listing.entries.map(entry => entry.name)), new Set([...names, 'folder']))
        assert.equal(listing.entries[0].kind, 'd')
        assert.equal(fs.existsSync(path.join(dir, 'MUST_NOT_EXIST')), false)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('empty listing is valid; missing directory and truncated output are not', { skip: !hasShell }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scp-empty-'))
    try {
        const output = execFileSync('sh', ['-c', protocol.listingCommand(dir)])
        assert.deepEqual(protocol.parseListing(output), { path: dir, entries: [] })
        assert.throws(() => protocol.parseListing(output.subarray(0, -1)))
        const missing = execFileSync('sh', ['-c', protocol.listingCommand(path.join(dir, 'missing'))], { stdio: ['ignore', 'pipe', 'ignore'] })
        assert.throws(() => protocol.parseListing(missing))
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
for (const size of [0, 100, 131073]) {
    test('download binary payload with size ' + size, async () => {
        const payload = Buffer.alloc(size)
        for (let i = 0; i < size; i++) { payload[i] = i % 256 }
        const channel = sender('é.txt', payload)
        const result = []
        await protocol.receiveFile(openChannel(channel), '/tmp/é.txt', async data => { result.push(data) }, signal(), noop)
        assert.deepEqual(Buffer.concat(result), payload)
        assert.equal(channel.commands[0], "scp -f '/tmp/é.txt'")
        assert.equal(channel.listeners(), 0)
        assert.ok(channel.closed)
    })
}
for (const header of ['C0644 1 ../escape\n', 'C0644 1 other\n', 'C0644 -1 file\n', 'C0644 9007199254740992 file\n', 'D0755 0 file\n']) {
    test('reject untrusted SCP header: ' + header.trim(), async () => {
        const channel = sender('file', Buffer.alloc(1), { header })
        let wrote = false
        await assert.rejects(protocol.receiveFile(openChannel(channel), '/file', async () => { wrote = true }, signal(), noop))
        assert.equal(wrote, false)
        assert.equal(channel.listeners(), 0)
    })
}
test('download rejects truncated payload and remote final error', async () => {
    for (const options of [{ header: 'C0644 5 file\n', truncated: true }, { final: Buffer.from('\x01read failed\n') }]) {
        const channel = sender('file', Buffer.from('abc'), options)
        await assert.rejects(protocol.receiveFile(openChannel(channel), '/file', async () => {}, signal(), noop))
        assert.equal(channel.listeners(), 0)
    }
})
for (const size of [0, 3, 150000]) {
    test('upload handshake and byte count: ' + size, async () => {
        const channel = receiver(size)
        const payload = Buffer.alloc(size, 123)
        await protocol.sendFile(openChannel(channel), '/tmp/file', size, chunks(payload.subarray(0, 2), payload.subarray(2)), signal(), noop)
        assert.equal(channel.commands[0], "scp -t '/tmp/file'")
        assert.equal(channel.writes[0].toString(), `C0600 ${size} file\n`)
        assert.deepEqual(Buffer.concat(channel.writes.slice(1, -1)), payload)
        assert.deepEqual(channel.writes.at(-1), Buffer.from([0]))
        assert.equal(channel.listeners(), 0)
    })
}
test('upload rejects changed length and negative final acknowledgement', async () => {
    await assert.rejects(protocol.sendFile(openChannel(receiver(2)), '/file', 2, chunks('abc'), signal(), noop), /changed/)
    await assert.rejects(protocol.sendFile(openChannel(receiver(4)), '/file', 4, chunks('abc'), signal(), noop), /truncated/)
    await assert.rejects(protocol.sendFile(openChannel(receiver(3, Buffer.from('\x02disk full\n'))), '/file', 3, chunks('abc'), signal(), noop), /disk full/)
})
test('abort interrupts a pending read and closes only its exec channel', async () => {
    const channel = new Channel(), controller = new AbortController()
    const stream = new protocol.ScpStream(channel, controller.signal)
    const pending = stream.byte()
    controller.abort()
    await assert.rejects(pending, /cancelled/)
    stream.close()
    assert.equal(channel.listeners(), 0)
    assert.ok(channel.closed)
})
test('idle timeout bounds an unanswered operation', async () => {
    const channel = new Channel()
    const stream = new protocol.ScpStream(channel, signal(), 15)
    try { await assert.rejects(stream.byte(), /timed out/) }
    finally { stream.close() }
    assert.equal(channel.listeners(), 0)
})
test('stderr explains a missing remote scp executable', async () => {
    const channel = new Channel()
    channel.onExec = () => { channel.extendedData$.emit([1, Buffer.from('scp: not found')]); channel.eof$.emit() }
    await assert.rejects(protocol.receiveFile(openChannel(channel), '/file', async () => {}, signal(), noop), /not found/)
    assert.equal(channel.listeners(), 0)
})
test('excessive control record and receive buffer are rejected', async () => {
    const channel = new Channel(), stream = new protocol.ScpStream(channel, signal())
    channel.data(Buffer.alloc(8193, 65))
    await assert.rejects(stream.line(), /too long/)
    stream.close()
    const other = new Channel(), bounded = new protocol.ScpStream(other, signal())
    other.data(Buffer.alloc(16 * 1024 * 1024 + 1))
    await assert.rejects(bounded.byte(), /buffer limit/)
    bounded.close()
})
test('session exec registers listeners before the command and releases all subscriptions', async () => {
    const channel = new Channel(), destroyed = new Event()
    channel.onExec = () => { channel.data('ok'); channel.eof$.emit() }
    const session = { willDestroy$: destroyed, ssh: { openSessionChannel: async () => 123, activateChannel: async () => channel } }
    const stream = await protocol.sessionExec(session)('echo ok', signal())
    assert.equal((await stream.output()).toString(), 'ok')
    stream.close()
    assert.equal(channel.listeners(), 0)
    assert.equal(destroyed.observers.size, 0)
})
test('session loss aborts an open operation', async () => {
    const channel = new Channel(), destroyed = new Event()
    const session = { willDestroy$: destroyed, ssh: { openSessionChannel: async () => 123, activateChannel: async () => channel } }
    const stream = await protocol.sessionExec(session)('scp -f /file', signal())
    const pending = stream.byte()
    destroyed.emit()
    await assert.rejects(pending, /cancelled/)
    stream.close()
    assert.equal(destroyed.observers.size, 0)
})
test('cancel during channel opening closes the eventual late channel', async () => {
    const channel = new Channel(), destroyed = new Event(), controller = new AbortController()
    let resolve
    const session = { willDestroy$: destroyed, ssh: { openSessionChannel: () => new Promise(r => { resolve = r }), activateChannel: async () => channel } }
    const pending = protocol.sessionExec(session)('noop', controller.signal)
    controller.abort()
    await assert.rejects(pending, /cancelled/)
    resolve(123)
    await new Promise(r => setImmediate(r))
    assert.ok(channel.closed)
    assert.equal(channel.commands.length, 0)
    assert.equal(destroyed.observers.size, 0)
})
test('download staging preserves an existing local file on failure and cleans temporary files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scp-disk-')), local = path.join(dir, 'file')
    try {
        fs.writeFileSync(local, 'original')
        const failing = sender('file', Buffer.from('bad'), { header: 'C0644 20 file\n', truncated: true })
        await assert.rejects(files.downloadFile(openChannel(failing), '/file', local, signal(), noop))
        assert.equal(fs.readFileSync(local, 'utf8'), 'original')
        assert.deepEqual(fs.readdirSync(dir), ['file'])
        await files.downloadFile(openChannel(sender('file', Buffer.from('complete'))), '/file', local, signal(), noop)
        assert.equal(fs.readFileSync(local, 'utf8'), 'complete')
        assert.deepEqual(fs.readdirSync(dir), ['file'])
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('upload stages the payload, then checks the remote rename status', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scp-upload-')), local = path.join(dir, "it's a file")
    try {
        fs.writeFileSync(local, 'abc')
        const sink = receiver(3), rename = new Channel()
        rename.onExec = () => { rename.data('\0SCP-MOVE-STATUS\0' + '0\0'); rename.eof$.emit() }
        const open = async (command, signal) => openChannel(command.startsWith('scp -t ') ? sink : rename)(command, signal)
        await files.uploadFile(open, local, '/tmp', signal(), noop)
        assert.match(sink.commands[0], /^scp -t '\/tmp\/\.tabby-scp-[a-f0-9]+\.part'$/)
        assert.match(rename.commands[0], /mv -f/)
        rename.onExec = () => { rename.data('\0SCP-MOVE-STATUS\0' + '1\0'); rename.eof$.emit() }
        const other = receiver(3)
        await assert.rejects(files.uploadFile(async (cmd, sig) => openChannel(cmd.startsWith('scp -t ') ? other : rename)(cmd, sig), local, '/tmp', signal(), noop), /temporary file may remain/)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('no SFTP call or local-process transfer in the SCP implementation', () => {
    for (const file of fs.readdirSync(path.join(root, 'src/scp')).filter(file => file.endsWith('.ts'))) {
        const source = fs.readFileSync(path.join(root, 'src/scp', file), 'utf8')
        assert.doesNotMatch(source, /\.openSFTP\s*\(|\.sftp\s*\(|from ['"]child_process|require\(['"]child_process/)
    }
})
test('feature defaults off and supplies Italian labels', () => {
    const { SidebarPlusScpConfigProvider } = load('src/scp/configProvider.ts', { 'tabby-core': { ConfigProvider: class {} } })
    assert.equal(new SidebarPlusScpConfigProvider().defaults.sidebarPlusScp.enabled, false)
    assert.equal(load('src/scp/messages.ts').scpMessages('it-IT').show, 'Mostra pannello SCP')
})

// Lifecycle tests run the real component with minimal host doubles; no network/Tabby instance.
class Subscriptions { add () {} unsubscribe () {} }
function componentFixture (tabs = []) {
    const metadata = []
    const app = { tabs, activeTab: tabs[0] || null, tabsChanged$: new Event() }
    const config = { store: { sidebarPlusScp: { enabled: false } }, save: async () => {}, changed$: new Event() }
    const tabHelpers = { getAllOpenTabs: () => app.tabs, isSSHTab: tab => !!tab, isLiveSSHTab: tab => !!tab?.live }
    const { SidebarPlusScpComponent } = load('src/scp/scpPanel.component.ts', {
        '@angular/core': { Component: data => { metadata.push(data); return target => target }, NgZone: class {} },
        'tabby-core': { SplitTabComponent: class {}, AppService: class {}, ConfigService: class {}, LocaleService: class {} },
        'rxjs': { Subscription: Subscriptions }, '../tabs': tabHelpers, '../electronRemote': { electronRemote: () => null },
    })
    const component = new SidebarPlusScpComponent(app, config, { getLocale: () => 'it-IT', localeChanged$: new Event() }, { run: fn => fn() })
    return { component, config, app, metadata }
}
test('disabled checkbox causes no remote listing or transfer', () => {
    const { component } = componentFixture([{ live: true, sshSession: {} }])
    let navigated = false
    component.navigate = async () => { navigated = true }
    component.sync()
    assert.equal(navigated, false)
    assert.equal(component.selected, null)
})
test('checkbox persists and enabling selects a live SSH session', async () => {
    const tab = { live: true, sshSession: {} }
    const { component, config } = componentFixture([tab])
    let navigated = false
    component.navigate = async () => { navigated = true }
    await component.setEnabled(true)
    assert.equal(config.store.sidebarPlusScp.enabled, true)
    assert.equal(component.selected, tab)
    assert.ok(navigated)
    await component.setEnabled(false)
    assert.equal(component.selected, null)
    assert.equal(component.enabled, false)
})
test('disabling, reconnecting and destroying abort stale operations', () => {
    const tab = { live: true, sshSession: {} }
    const { component, config } = componentFixture([tab])
    component.navigate = async () => {}
    config.store.sidebarPlusScp.enabled = true
    component.sync()
    let operation = new AbortController()
    component.operation = operation
    tab.sshSession = {}
    component.sync()
    assert.equal(operation.signal.aborted, true)
    operation = new AbortController()
    component.operation = operation
    component.ngOnDestroy()
    assert.equal(operation.signal.aborted, true)
    assert.equal(component.current(operation.signal), false)
})
