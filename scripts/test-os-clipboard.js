const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const nodePath = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

/**
 * Reading the files copied in the system file manager. A wrong parse here
 * uploads the wrong local file, and Electron's clipboard cannot run in a test,
 * so the clipboard, `fs` and the platform are stubbed. `existing` is the set
 * of paths the fake disk holds, `formats` what the fake clipboard holds.
 */
function load ({ platform = 'linux', existing = [], formats = {} } = {}) {
    const exports = {}
    const disk = new Set(existing)
    const clipboard = {
        read: format => {
            if (!(format in formats)) {
                throw new Error('absent')
            }
            return formats[format]
        },
        readBuffer: format => format in formats ? formats[format] : Buffer.alloc(0),
    }
    const context = {
        exports,
        Buffer,
        URL,
        process: { platform },
        window: { require: name => name === 'electron' ? { clipboard } : null },
        require: name => {
            if (name === 'fs') {
                return { existsSync: p => disk.has(p) }
            }
            if (name === 'path') {
                return platform === 'win32' ? nodePath.win32 : nodePath.posix
            }
            if (name === './electronRemote') {
                return { electronRemote: () => null }
            }
            return {}
        },
    }
    const source = fs.readFileSync(nodePath.join(__dirname, '..', 'src', 'osClipboard.ts'), 'utf8')
    const js = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    vm.runInNewContext(js, context)
    return exports
}

const plain = value => JSON.parse(JSON.stringify(value))

/**
 * A `Shell IDList Array` (CIDA) block as Explorer writes it: the item count,
 * then count + 1 offsets, then the ID lists. The lists are left as filler,
 * only the header is read.
 */
function cida (count) {
    const header = Buffer.alloc(4 + 4 * (count + 1))
    header.writeUInt32LE(count, 0)
    for (let i = 0; i <= count; i++) {
        header.writeUInt32LE(header.length + i * 4, 4 + 4 * i)
    }
    return Buffer.concat([header, Buffer.alloc(4 * (count + 1))])
}

const fileNameW = (...paths) => Buffer.from(paths.join('\u0000') + '\u0000\u0000', 'utf16le')

test('FileNameW paths are split on NUL and survive the double terminator', () => {
    const { parseFileNameW, parseFileName } = load()
    assert.deepEqual(plain(parseFileNameW(fileNameW('C:\\Users\\me\\a.txt', 'D:\\data\\b c.txt'))), ['C:\\Users\\me\\a.txt', 'D:\\data\\b c.txt'])
    assert.deepEqual(plain(parseFileNameW(Buffer.from('\u0000\u0000', 'utf16le'))), [])
    assert.deepEqual(plain(parseFileName(Buffer.from('C:\\a.txt\u0000\u0000', 'latin1'))), ['C:\\a.txt'])
})

test('the item count of a Shell IDList Array is read from its header, and a malformed one is ignored', () => {
    const { parseShellIdListCount } = load()
    assert.equal(parseShellIdListCount(cida(1)), 1)
    assert.equal(parseShellIdListCount(cida(3)), 3)
    assert.equal(parseShellIdListCount(Buffer.alloc(0)), null)
    assert.equal(parseShellIdListCount(null), null)
    // A count the buffer cannot hold the offsets for is not a CIDA.
    const lying = Buffer.alloc(8)
    lying.writeUInt32LE(50, 0)
    assert.equal(parseShellIdListCount(lying), null)
})

test('uri lists yield local paths only, decoded, and never another host', () => {
    const { parseUriList } = load()
    const text = [
        '# copied from a file manager',
        'copy',
        'file:///home/me/report%20final.pdf',
        '',
        'file:///C:/Users/me/notes.txt',
        'https://example.com/not-a-file',
        'file://server/share/secret.txt',
        'file://localhost/tmp/x',
        'file:///tmp/dir/',
    ].join('\r\n')
    assert.deepEqual(plain(parseUriList(text)), ['/home/me/report final.pdf', 'C:/Users/me/notes.txt', '/tmp/x', '/tmp/dir/'])
    assert.deepEqual(plain(parseUriList('')), [])
})

test('a file URI keeps its path, a Windows drive loses the leading slash, others are refused', () => {
    const { localPathFromUri } = load()
    assert.equal(localPathFromUri('file:///home/me/a.txt'), '/home/me/a.txt')
    assert.equal(localPathFromUri('file:///C:/Users/me/a.txt'), 'C:/Users/me/a.txt')
    assert.equal(localPathFromUri('file:///tmp/with%20space/x'), '/tmp/with space/x')
    assert.equal(localPathFromUri('http://example.com/x'), null)
    assert.equal(localPathFromUri('not a url'), null)
    assert.equal(localPathFromUri('file:///%E0%A4%A'), null)
})

test('only absolute paths that exist are kept, each once', () => {
    const { usablePaths } = load()
    const exists = p => p !== '/gone'
    assert.deepEqual(plain(usablePaths(['/a', 'relative/b', '/gone', '/a', '', '/c'], exists)), ['/a', '/c'])
    assert.deepEqual(plain(usablePaths(['/a'], () => { throw new Error('EACCES') })), [])
})

test('Linux: a file manager copy is read from text/uri-list, the listed paths make the fingerprint', () => {
    const { readOsClipboardFiles, osClipboardFingerprint } = load({
        existing: ['/home/me/a.txt'],
        formats: { 'text/uri-list': 'file:///home/me/a.txt\r\nfile:///home/me/deleted.txt\r\n' },
    })
    const files = readOsClipboardFiles()
    assert.deepEqual(plain(files.existing), ['/home/me/a.txt'])
    assert.equal(files.copiedCount, null)
    // The deleted file still counts in the fingerprint, because deleting it
    // must not make an old copy look new.
    assert.equal(osClipboardFingerprint(files), '/home/me/a.txt\n/home/me/deleted.txt')
})

test('GNOME Files: x-special/gnome-copied-files is read, its "copy" line dropped', () => {
    const { readOsClipboardFiles } = load({
        existing: ['/home/me/a.txt'],
        formats: { 'x-special/gnome-copied-files': 'copy\nfile:///home/me/a.txt' },
    })
    assert.deepEqual(plain(readOsClipboardFiles().existing), ['/home/me/a.txt'])
})

test('plain text is never read as a file, even when it looks like a path', () => {
    const { readOsClipboardFiles } = load({
        existing: ['/etc/passwd'],
        formats: { 'text/plain': 'file:///etc/passwd', text: '/etc/passwd' },
    })
    const files = readOsClipboardFiles()
    assert.deepEqual(plain(files.listed), [])
    assert.deepEqual(plain(files.existing), [])
})

test('Windows: one file copied in Explorer is read from FileNameW', () => {
    const { readOsClipboardFiles } = load({
        platform: 'win32',
        existing: ['C:\\Users\\me\\a.txt'],
        formats: { FileNameW: fileNameW('C:\\Users\\me\\a.txt'), 'Shell IDList Array': cida(1) },
    })
    const files = readOsClipboardFiles()
    assert.deepEqual(plain(files.existing), ['C:\\Users\\me\\a.txt'])
    assert.equal(files.copiedCount, null)
})

test('Windows: several files copied in Explorer are detected, since FileNameW only names the first', () => {
    const { readOsClipboardFiles } = load({
        platform: 'win32',
        existing: ['C:\\Users\\me\\a.txt'],
        formats: { FileNameW: fileNameW('C:\\Users\\me\\a.txt'), 'Shell IDList Array': cida(3) },
    })
    assert.equal(readOsClipboardFiles().copiedCount, 3)
})

test('Windows: without FileNameW the ANSI FileName is used, and nothing at all gives no files', () => {
    const ansi = load({
        platform: 'win32',
        existing: ['C:\\a.txt'],
        formats: { FileName: Buffer.from('C:\\a.txt\u0000\u0000', 'latin1') },
    })
    assert.deepEqual(plain(ansi.readOsClipboardFiles().existing), ['C:\\a.txt'])
    const empty = load({ platform: 'win32' })
    assert.deepEqual(plain(empty.readOsClipboardFiles()), { listed: [], existing: [], copiedCount: null })
})
