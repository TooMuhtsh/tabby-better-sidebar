const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

/**
 * The SFTP clipboard decides things that destroy files when they are wrong:
 * which clipboard a paste reads, what a name collision may do, which key
 * belongs to the panel rather than to the terminal. Those decisions are pure
 * functions, checked here without an SFTP session, a panel or Angular.
 *
 * Each module is transpiled with `ts.transpileModule` and run in its own
 * context, with the few modules it requires stubbed.
 */
function load (file, stubs = {}) {
    const exports = {}
    const context = {
        exports,
        require: name => {
            if (name in stubs) {
                return stubs[name]
            }
            if (name === '@angular/core') {
                return { Injectable: () => target => target }
            }
            return {}
        },
    }
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8')
    const js = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true },
    }).outputText
    vm.runInNewContext(js, context)
    return exports
}

/** Arrays built in the other context are rebuilt here, for `deepEqual`. */
const plain = value => JSON.parse(JSON.stringify(value))

const entry = (name, parent = '/srv', isDirectory = false) => ({
    name,
    path: `${parent}/${name}`,
    isDirectory,
    size: 10,
    mode: 0o100644,
})

// ---------------------------------------------------------------- planning

test('a path is inside itself and its descendants, with the separator respected', () => {
    const { isPathInside } = load('sftpClipboard.service.ts')
    assert.equal(isPathInside('/srv/data', '/srv/data'), true)
    assert.equal(isPathInside('/srv/data', '/srv/data/file.txt'), true)
    assert.equal(isPathInside('/srv/data', '/srv/data/sub/dir'), true)
    // The prefix trap, a sibling whose name merely starts the same way.
    assert.equal(isPathInside('/srv/data', '/srv/database/file.txt'), false)
    assert.equal(isPathInside('/srv/data', '/srv'), false)
    assert.equal(isPathInside('/srv/data/', '/srv/data/file.txt'), true)
})

test('a copy is transferred, a cut within one session is a rename, a cut across sessions is transferred', () => {
    const { planPaste } = load('sftpClipboard.service.ts')
    const entries = [entry('a.txt'), entry('b.txt')]
    const copied = planPaste({ entries, destination: '/srv/other', sameSession: true, cut: false })
    assert.equal(copied.byRename, false)
    assert.deepEqual(plain(copied.accepted.map(e => e.name)), ['a.txt', 'b.txt'])

    const cut = planPaste({ entries, destination: '/srv/other', sameSession: true, cut: true })
    assert.equal(cut.byRename, true)
    assert.deepEqual(plain(cut.accepted.map(e => e.name)), ['a.txt', 'b.txt'])

    const across = planPaste({ entries, destination: '/srv/other', sameSession: false, cut: true })
    assert.equal(across.byRename, false)
})

test('an entry cannot be pasted into its own subtree', () => {
    const { planPaste } = load('sftpClipboard.service.ts')
    const directory = entry('data', '/srv', true)
    for (const destination of ['/srv/data', '/srv/data/sub']) {
        for (const cut of [true, false]) {
            const plan = planPaste({ entries: [directory], destination, sameSession: true, cut })
            assert.equal(plan.accepted.length, 0, destination)
            assert.deepEqual(plain(plan.rejected.map(r => [r.entry.name, r.reason])), [['data', 'inside']], destination)
        }
    }
    const sibling = planPaste({ entries: [directory], destination: '/srv/database', sameSession: true, cut: true })
    assert.deepEqual(plain(sibling.accepted.map(e => e.name)), ['data'])
})

test('a cut pasted back into its own folder does nothing, a copy there goes on to the collision question', () => {
    const { planPaste } = load('sftpClipboard.service.ts')
    for (const destination of ['/srv', '/srv/']) {
        const cut = planPaste({ entries: [entry('a.txt')], destination, sameSession: true, cut: true })
        assert.deepEqual(plain(cut.rejected.map(r => r.reason)), ['here'], destination)
        const copy = planPaste({ entries: [entry('a.txt')], destination, sameSession: true, cut: false })
        assert.equal(copy.accepted.length, 1, destination)
    }
    // At the root, the parent of `/a.txt` is `/`.
    const atRoot = planPaste({ entries: [entry('a.txt', '')], destination: '/', sameSession: true, cut: true })
    assert.deepEqual(plain(atRoot.rejected.map(r => r.reason)), ['here'])
})

// ---------------------------------------------------- which clipboard wins

test('files copied in the system before a panel copy do not win over it (stale clipboard)', () => {
    const { pickPasteSource } = load('sftpClipboard.service.ts')
    // Explorer copy long ago, never pasted, then Ctrl+C on a remote file. The
    // snapshot taken at that Ctrl+C holds the old files.
    assert.equal(pickPasteSource({ os: 'C:\\old.txt', panelHasEntries: true, osAtPanelCopy: 'C:\\old.txt', lastOsPaste: undefined }), 'panel')
    // A new copy in Explorer after the panel copy wins.
    assert.equal(pickPasteSource({ os: 'C:\\new.txt', panelHasEntries: true, osAtPanelCopy: 'C:\\old.txt', lastOsPaste: undefined }), 'os')
    // Once it has been pasted, the panel clipboard is used again.
    assert.equal(pickPasteSource({ os: 'C:\\new.txt', panelHasEntries: true, osAtPanelCopy: 'C:\\old.txt', lastOsPaste: 'C:\\new.txt' }), 'panel')
})

test('with no panel clipboard, system files are pasted, again and again', () => {
    const { pickPasteSource } = load('sftpClipboard.service.ts')
    assert.equal(pickPasteSource({ os: '/home/me/a', panelHasEntries: false, osAtPanelCopy: undefined, lastOsPaste: undefined }), 'os')
    assert.equal(pickPasteSource({ os: '/home/me/a', panelHasEntries: false, osAtPanelCopy: undefined, lastOsPaste: '/home/me/a' }), 'os')
    assert.equal(pickPasteSource({ os: '', panelHasEntries: true, osAtPanelCopy: '', lastOsPaste: undefined }), 'panel')
    assert.equal(pickPasteSource({ os: '', panelHasEntries: false, osAtPanelCopy: undefined, lastOsPaste: undefined }), 'none')
})

// ------------------------------------------------------- the clipboard itself

test('the clipboard keeps frozen copies, so a paste can never rename its entries', () => {
    const { SidebarPlusSftpClipboardService } = load('sftpClipboard.service.ts')
    const clipboard = new SidebarPlusSftpClipboardService()
    const source = {}
    const given = [entry('a.txt')]
    clipboard.set(given, false, source, 'snapshot')
    // Changing what was handed in does not reach the clipboard.
    given[0].name = 'changed.txt'
    given.push(entry('b.txt'))
    assert.equal(clipboard.count, 1)
    assert.equal(clipboard.entries[0].name, 'a.txt')
    // And the clipboard's own entries refuse to change (the fork renamed them
    // on "keep both", so the next paste used the new name).
    assert.throws(() => { 'use strict'; clipboard.entries[0].name = 'renamed.txt' })
    assert.equal(clipboard.entries[0].name, 'a.txt')
    assert.throws(() => clipboard.entries.push(entry('c.txt')))
    assert.equal(clipboard.osAtPanelCopy, 'snapshot')
})

test('the clipboard keeps its cut flag and source session, and empties', () => {
    const { SidebarPlusSftpClipboardService } = load('sftpClipboard.service.ts')
    const clipboard = new SidebarPlusSftpClipboardService()
    const source = {}
    assert.equal(clipboard.hasEntries, false)
    assert.equal(clipboard.isFrom(source), false)
    clipboard.set([entry('a.txt')], true, source, '')
    assert.equal(clipboard.hasEntries, true)
    assert.equal(clipboard.cut, true)
    assert.equal(clipboard.isFrom(source), true)
    assert.equal(clipboard.isFrom({}), false)
    clipboard.clear()
    assert.equal(clipboard.hasEntries, false)
    assert.equal(clipboard.cut, false)
    assert.equal(clipboard.isFrom(source), false)
})

test('the clipboard empties itself when its source session closes', () => {
    const { SidebarPlusSftpClipboardService } = load('sftpClipboard.service.ts')
    const listeners = []
    const source = { closed$: { subscribe: fn => { listeners.push(fn); return { unsubscribe: () => listeners.splice(listeners.indexOf(fn), 1) } } } }
    const clipboard = new SidebarPlusSftpClipboardService()
    clipboard.set([entry('a.txt')], false, source, '')
    assert.equal(listeners.length, 1)
    listeners[0]()
    assert.equal(clipboard.hasEntries, false)
    // A new copy drops the watch on the previous session.
    clipboard.set([entry('a.txt')], false, source, '')
    clipboard.set([entry('b.txt')], false, {}, '')
    assert.equal(listeners.length, 0)
})

// ------------------------------------------------------- keys and the terminal

const key = (k, extra = {}) => ({
    key: k,
    code: /^[a-z]$/i.test(k) ? `Key${k.toUpperCase()}` : k,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...extra,
})
const panel = (extra = {}) => ({ platform: 'win32', inPanel: true, inField: false, onControl: false, canGoUp: true, ...extra })

test('Ctrl+C typed outside the panel is never taken, so the terminal gets its SIGINT', () => {
    const { routePanelKey } = load('sftpClipboard.service.ts')
    for (const k of ['c', 'x', 'v']) {
        assert.equal(routePanelKey(key(k, { ctrlKey: true }), panel({ inPanel: false })), null, k)
    }
    assert.equal(routePanelKey(key('Enter'), panel({ inPanel: false })), null)
    assert.equal(routePanelKey(key('Backspace'), panel({ inPanel: false })), null)
})

test('in the panel, Ctrl (Cmd on macOS) with C, X, V are the file commands', () => {
    const { routePanelKey } = load('sftpClipboard.service.ts')
    assert.equal(routePanelKey(key('c', { ctrlKey: true }), panel()), 'copy')
    assert.equal(routePanelKey(key('x', { ctrlKey: true }), panel()), 'cut')
    assert.equal(routePanelKey(key('V', { ctrlKey: true }), panel()), 'paste')
    assert.equal(routePanelKey(key('c', { metaKey: true }), panel({ platform: 'darwin' })), 'copy')
    // Ctrl on macOS and the Windows key elsewhere are not the command key.
    assert.equal(routePanelKey(key('c', { ctrlKey: true }), panel({ platform: 'darwin' })), null)
    assert.equal(routePanelKey(key('c', { metaKey: true }), panel()), null)
    // A layout whose letters are not Latin still has the physical key.
    assert.equal(routePanelKey({ ...key('c', { ctrlKey: true }), key: 'с', code: 'KeyC' }, panel()), 'copy')
})

test('fields, Shift, Alt and composition keep their keys', () => {
    const { routePanelKey } = load('sftpClipboard.service.ts')
    assert.equal(routePanelKey(key('c', { ctrlKey: true }), panel({ inField: true })), null)
    assert.equal(routePanelKey(key('Enter'), panel({ inField: true })), null)
    // Ctrl+Shift+C/V are Tabby's own terminal copy and paste.
    assert.equal(routePanelKey(key('c', { ctrlKey: true, shiftKey: true }), panel()), null)
    assert.equal(routePanelKey(key('v', { ctrlKey: true, altKey: true }), panel()), null)
    assert.equal(routePanelKey({ ...key('v', { ctrlKey: true }), isComposing: true }, panel()), null)
})

test('Enter opens and Backspace goes up, except on a button or at the root', () => {
    const { routePanelKey } = load('sftpClipboard.service.ts')
    assert.equal(routePanelKey(key('Enter'), panel()), 'open')
    assert.equal(routePanelKey(key('Backspace'), panel()), 'up')
    assert.equal(routePanelKey(key('Backspace'), panel({ canGoUp: false })), null)
    assert.equal(routePanelKey(key('Enter'), panel({ onControl: true })), null)
    // Clipboard keys still work with a toolbar button focused.
    assert.equal(routePanelKey(key('c', { ctrlKey: true }), panel({ onControl: true })), 'copy')
    assert.equal(routePanelKey(key('Enter', { shiftKey: true }), panel()), null)
    assert.equal(routePanelKey(key('a', { ctrlKey: true }), panel()), null)
})

// ------------------------------------------------------- names and collisions

test('"keep both" produces the next free name, extension intact', () => {
    const { freeRemoteName } = load('remoteNames.ts')
    assert.equal(freeRemoteName('report.pdf', new Set(['report.pdf', 'report (2).pdf'])), 'report (3).pdf')
    assert.equal(freeRemoteName('fresh.tar.gz', new Set(['other.tar.gz'])), 'fresh.tar.gz')
    assert.equal(freeRemoteName('bundle.tar.gz', new Set(['bundle.tar.gz'])), 'bundle.tar (2).gz')
    assert.equal(freeRemoteName('.bashrc', new Set(['.bashrc'])), '.bashrc (2)')
    assert.equal(freeRemoteName('README', new Set(['README'])), 'README (2)')
})

/** A scripted dialog that answers in order and records every question. */
function dialog (...answers) {
    const asked = []
    const ask = async question => {
        asked.push(plain(question))
        return answers.length ? answers.shift() : null
    }
    return { ask, asked }
}

const existing = pairs => new Map(pairs.map(([name, isFile]) => [name, { isFile }]))
const noRelist = async () => []
const settledNames = result => plain(result.settled.map(s => [s.name, s.overwrite]))

test('Overwrite is offered for a file onto a regular file only', async () => {
    const { settleNameCollisions } = load('remoteNames.ts')
    const cases = [
        // incoming, existing is a regular file, offered
        [{ name: 'a', isDirectory: false }, true, true],
        [{ name: 'a', isDirectory: true }, true, false],
        [{ name: 'a', isDirectory: false }, false, false],
        [{ name: 'a', isDirectory: true }, false, false],
        [{ name: 'a', isDirectory: false, isItself: true }, true, false],
    ]
    for (const [item, isFile, offered] of cases) {
        const { ask, asked } = dialog({ choice: 'skip', applyToAll: false })
        await settleNameCollisions([item], existing([['a', isFile]]), ask, noRelist)
        assert.equal(asked[0].canOverwrite, offered, JSON.stringify([item, isFile]))
    }
})

test('an Overwrite that is not allowed (a folder) is read as Skip, never carried out', async () => {
    const { settleNameCollisions } = load('remoteNames.ts')
    const { ask } = dialog({ choice: 'overwrite', applyToAll: false })
    const result = await settleNameCollisions([{ name: 'dir', isDirectory: true }], existing([['dir', false]]), ask, noRelist)
    assert.equal(result.settled.length, 0)
    assert.equal(result.skipped.length, 1)
})

test('a dismissed dialog skips, Overwrite and Keep both do what they say', async () => {
    const { settleNameCollisions } = load('remoteNames.ts')
    const items = [{ name: 'a.txt', isDirectory: false }, { name: 'b.txt', isDirectory: false }, { name: 'c.txt', isDirectory: false }]
    const { ask, asked } = dialog(null, { choice: 'overwrite', applyToAll: false }, { choice: 'rename', applyToAll: false })
    const result = await settleNameCollisions(items, existing([['a.txt', true], ['b.txt', true], ['c.txt', true]]), ask, noRelist)
    assert.deepEqual(plain(result.skipped.map(s => s.name)), ['a.txt'])
    assert.deepEqual(settledNames(result), [['b.txt', true], ['c (2).txt', false]])
    assert.deepEqual(asked.map(q => q.moreToCome), [true, true, false])
})

test('"do this for the remaining files" answers the rest, and Keep both never hands out a name twice', async () => {
    const { settleNameCollisions } = load('remoteNames.ts')
    // Three collisions on names whose "(2)" form is already taken, plus an
    // incoming file named exactly like a "keep both" candidate.
    const items = [
        { name: 'a.txt', isDirectory: false },
        { name: 'a (3).txt', isDirectory: false },
        { name: 'b.txt', isDirectory: false },
        { name: 'dir', isDirectory: true },
    ]
    const { ask, asked } = dialog({ choice: 'rename', applyToAll: true })
    const relist = async () => ['a.txt', 'a (2).txt', 'b.txt', 'dir']
    const result = await settleNameCollisions(items, existing([['a.txt', true], ['a (2).txt', true], ['b.txt', true], ['dir', false]]), ask, relist)
    assert.equal(asked.length, 1)
    assert.deepEqual(settledNames(result), [['a (4).txt', false], ['a (3).txt', false], ['b (2).txt', false], ['dir (2)', false]])
})

test('a standing Overwrite does not reach a folder, so the dialog asks again', async () => {
    const { settleNameCollisions } = load('remoteNames.ts')
    const items = [{ name: 'f', isDirectory: false }, { name: 'd', isDirectory: true }, { name: 'g', isDirectory: false }]
    const { ask, asked } = dialog({ choice: 'overwrite', applyToAll: true }, { choice: 'skip', applyToAll: false })
    const result = await settleNameCollisions(items, existing([['f', true], ['d', false], ['g', true]]), ask, noRelist)
    assert.deepEqual(asked.map(q => q.name), ['f', 'd'])
    assert.equal(asked[1].canOverwrite, false)
    assert.deepEqual(settledNames(result), [['f', true], ['g', true]])
    assert.deepEqual(plain(result.skipped.map(s => s.name)), ['d'])
})

test('two entries of one batch with the same name collide with each other, without Overwrite', async () => {
    const { settleNameCollisions } = load('remoteNames.ts')
    const items = [{ name: 'a.txt', isDirectory: false }, { name: 'a.txt', isDirectory: false }]
    const { ask, asked } = dialog({ choice: 'rename', applyToAll: false })
    const result = await settleNameCollisions(items, existing([]), ask, noRelist)
    assert.equal(asked.length, 1)
    assert.equal(asked[0].canOverwrite, false)
    assert.deepEqual(settledNames(result), [['a.txt', false], ['a (2).txt', false]])
})

test('settling names never modifies the entries it is given', async () => {
    const { settleNameCollisions } = load('remoteNames.ts')
    const items = [Object.freeze({ name: 'a.txt', isDirectory: false })]
    const { ask } = dialog({ choice: 'rename', applyToAll: false })
    const result = await settleNameCollisions(items, existing([['a.txt', true]]), ask, noRelist)
    assert.equal(items[0].name, 'a.txt')
    assert.equal(result.settled[0].item, items[0])
    assert.equal(result.settled[0].name, 'a (2).txt')
})
