/**
 * Vérifie que les tables de `src/i18n/` collent aux chaînes sources du code.
 *
 * Adapté du `tools/lint-i18n.js` de tabby-better-vault — contrat dupliqué
 * entre les plugins Better, comme betterPanel.ts. La raison d'être est la
 * même : le mécanisme de traduction de Tabby utilise la chaîne source
 * anglaise comme clé et rend la clé elle-même faute de traduction — une clé
 * désuète ne provoque NI erreur NI avertissement, la phrase retombe juste en
 * anglais. Ce script rend la dérive visible, dans les deux sens (traduction
 * manquante / clé morte), plus : paramètres perdus, pièges ICU (apostrophe
 * collée à une accolade), codes de locale inconnus de Tabby, et collisions
 * avec les msgid de Tabby (valeur différente = on écrase SA traduction pour
 * l'application entière).
 *
 * Différence avec le vault : l'extraction balaie TOUT src/ (le vault liste
 * ses fichiers un à un) — littéraux `'...' | translate` dans les .pug,
 * `i18n.t('...')` et `message: '...'` (voir `src/i18nMessage.ts`) dans les
 * .ts. Limite assumée identique : extraction lexicale, une chaîne rangée
 * dans une constante puis traduite ailleurs se déclare dans EXTRA_SOURCES.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const TABBY_CORE = path.join(ROOT, 'node_modules', 'tabby-core', 'dist', 'index.js')

/** Littéral simple quote, échappements compris. */
const STR = "'((?:[^'\\\\]|\\\\.)*)'"

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8')
const unescape = s => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\')

/** Chaînes que l'extraction lexicale ne peut pas voir : { file, constant }. */
const EXTRA_SOURCES = [
    // profileModal.ts a délibérément aucun accès à l'injecteur — la clé sort
    // telle quelle, traduite par les deux appelants de sidebarTree.component.ts.
    { file: 'profileModal.ts', constant: 'PROFILE_MODAL_UNAVAILABLE' },
]

/** Tous les fichiers sous src/ (récursif) filtrés par extension, chemins relatifs à src/. */
function walk (dir = SRC) {
    const out = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            out.push(...walk(full))
        } else {
            out.push(path.relative(SRC, full).replace(/\\/g, '/'))
        }
    }
    return out
}

function collectSources () {
    const sources = new Map() // chaîne -> origine, pour un rapport lisible
    const add = (value, where) => {
        const key = unescape(value)
        if (!sources.has(key)) {
            sources.set(key, where)
        }
    }

    const files = walk().filter(f => !f.startsWith('i18n/') && !f.endsWith('.d.ts'))
    for (const f of files) {
        if (f.endsWith('.pug')) {
            for (const m of read(f).matchAll(new RegExp(STR + '\\s*\\|\\s*translate', 'g'))) {
                add(m[1], f)
            }
        } else if (f.endsWith('.ts')) {
            for (const m of read(f).matchAll(new RegExp('i18n\\.t\\(\\s*' + STR, 'g'))) {
                add(m[1], f)
            }
            // `TranslatableMessage` literals (src/i18nMessage.ts): pure
            // modules with no injector access — groupShare.ts,
            // workspaceShare.ts, svgSanitizer.ts — hand back
            // `{ message: '...', params: {...} }` instead of calling
            // `i18n.t()` themselves, translated at the point of display.
            // Same extraction as the pipe/`i18n.t()` cases above, just a
            // different literal shape.
            for (const m of read(f).matchAll(new RegExp('message:\\s*' + STR, 'g'))) {
                add(m[1], f)
            }
        }
    }

    for (const extra of EXTRA_SOURCES) {
        const content = read(extra.file)
        const m = new RegExp('const ' + extra.constant + ' = ' + STR).exec(content)
        if (!m) {
            console.error(`EXTRA_SOURCES obsolète : ${extra.constant} n'est plus défini dans ${extra.file}`)
            process.exitCode = 1
            continue
        }
        add(m[1], `${extra.file} (${extra.constant})`)
    }

    return sources
}

function loadTable (lang) {
    const raw = fs.readFileSync(path.join(SRC, 'i18n', `${lang}.ts`), 'utf8')
    // Les tables sont nommées puis exportées (`const x = {...}` + `export
    // default x`) : on isole le littéral d'objet qui suit la déclaration.
    const start = raw.search(/const \w+: Record<string, string> = \{|export default \{/)
    const body = sliceLiteral(raw, raw.indexOf('{', start), '{', '}')
    // eslint-disable-next-line no-eval
    return eval('(' + body + ')')
}

/** Noms des paramètres `{x}` d'une chaîne. */
function placeholders (text) {
    return new Set([...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]))
}

/** Défauts qu'ICU MessageFormat ne révélerait qu'à l'affichage (apostrophe = échappement). */
function icuProblems (text) {
    const problems = []
    const s = String(text)
    if (/'[{}]/.test(s)) {
        problems.push('apostrophe droite collée à une accolade (ICU l\'interprète comme un échappement)')
    }
    let depth = 0
    for (const c of s) {
        if (c === '{') depth++
        if (c === '}') depth--
        if (depth < 0) break
    }
    if (depth !== 0) {
        problems.push('accolades déséquilibrées')
    }
    return problems
}

function tabbyBundle () {
    try {
        return fs.readFileSync(TABBY_CORE, 'utf8')
    } catch {
        return null
    }
}

/** Isole un littéral d'objet/tableau en équilibrant les délimiteurs hors chaînes. */
function sliceLiteral (text, from, open, close) {
    let depth = 0
    let quote = null
    for (let i = from; i < text.length; i++) {
        const c = text[i]
        if (quote) {
            if (c === '\\') {
                i++
            } else if (c === quote) {
                quote = null
            }
            continue
        }
        if (c === '"' || c === "'") {
            quote = c
        } else if (c === open) {
            depth++
        } else if (c === close) {
            depth--
            if (!depth) {
                return text.slice(from, i + 1)
            }
        }
    }
    return null
}

/** Locales que Tabby connaît (`LocaleService.allLanguages` du bundle). */
function tabbyLocales (bundle) {
    const marker = 'LocaleService.allLanguages = '
    const at = bundle.indexOf(marker)
    if (at === -1) {
        return null
    }
    const literal = sliceLiteral(bundle, bundle.indexOf('[', at), '[', ']')
    if (!literal) {
        return null
    }
    return new Set([...literal.matchAll(/code:\s*'([\w-]+)'/g)].map(m => m[1]))
}

/** msgid que Tabby traduit déjà pour cette locale (les .po bundlés en JSON). */
function tabbyMessages (bundle, lang) {
    const at = bundle.indexOf(`"../locale/${lang}.po":`)
    if (at === -1) {
        return null
    }
    const exportsAt = bundle.indexOf('module.exports = ', at)
    const literal = sliceLiteral(bundle, bundle.indexOf('{', exportsAt), '{', '}')
    if (!literal) {
        return null
    }
    try {
        const po = JSON.parse(literal)
        const entries = po.translations?.[''] ?? {}
        const messages = new Map()
        for (const [msgid, entry] of Object.entries(entries)) {
            if (msgid) {
                messages.set(msgid, entry?.msgstr?.[0] ?? '')
            }
        }
        return messages
    } catch {
        return null
    }
}

/** Locales réellement ENREGISTRÉES par src/i18n/index.ts (pas la liste des fichiers). */
function registeredTables () {
    const raw = read('i18n/index.ts')
    const at = raw.indexOf('const TABLES')
    const literal = at === -1 ? null : sliceLiteral(raw, raw.indexOf('{', at), '{', '}')
    if (!literal) {
        console.error("src/i18n/index.ts : impossible de relire la table TABLES — le contrôle d'enregistrement est HORS SERVICE.")
        process.exitCode = 1
        return []
    }

    const registered = [...literal.matchAll(/'([\w-]+)'\s*:\s*(\w+)/g)].map(m => ({ lang: m[1], binding: m[2] }))
    const files = fs.readdirSync(path.join(SRC, 'i18n'))
        .filter(f => f.endsWith('.ts') && f !== 'index.ts')
        .map(f => f.replace(/\.ts$/, ''))

    for (const lang of files) {
        if (!registered.some(r => r.lang === lang)) {
            console.error(`  ${lang} : table présente mais JAMAIS ENREGISTRÉE dans TABLES — elle ne s'affichera pas.`)
            process.exitCode = 1
        }
    }
    for (const { lang, binding } of registered) {
        if (!files.includes(lang)) {
            console.error(`  ${lang} : enregistrée dans TABLES sans fichier src/i18n/${lang}.ts.`)
            process.exitCode = 1
        }
        if (!new RegExp(`import\\s+${binding}\\s+from\\s+'\\./${lang}'`).test(raw)) {
            console.error(`  ${lang} : enregistrée sous le nom « ${binding} », qui n'importe pas ./${lang}.`)
            process.exitCode = 1
        }
    }

    return registered.map(r => r.lang)
}

const bundle = tabbyBundle()
const locales = bundle ? tabbyLocales(bundle) : null

const LANGS = registeredTables()

const sources = collectSources()
let failures = 0

console.log(`${sources.size} chaînes sources relevées dans src/.`)
console.log(`${LANGS.length} table(s) enregistrée(s) dans src/i18n/index.ts : ${LANGS.join(', ') || '(aucune)'}.`)

if (!bundle) {
    console.log('tabby-core absent de node_modules : codes de locale et collisions de msgid NON VÉRIFIÉS.')
} else if (!locales) {
    console.log('LocaleService.allLanguages introuvable dans le bundle : codes de locale NON VÉRIFIÉS.')
} else {
    for (const lang of LANGS) {
        if (!locales.has(lang)) {
            console.error(`  ${lang} : code inconnu de Tabby — la locale ne sera jamais activée, la table jamais lue.`)
            failures++
        }
    }
}

for (const lang of LANGS) {
    const table = loadTable(lang)
    const keys = new Set(Object.keys(table))

    const missing = [...sources.keys()].filter(s => !keys.has(s))
    const dead = [...keys].filter(k => !sources.has(k))
    const empty = [...keys].filter(k => !String(table[k]).trim())

    const paramMismatch = []
    const icu = []
    for (const k of keys) {
        const expected = placeholders(k)
        const actual = placeholders(table[k])
        const lost = [...expected].filter(p => !actual.has(p))
        const invented = [...actual].filter(p => !expected.has(p))
        if (lost.length || invented.length) {
            paramMismatch.push({ key: k, lost, invented })
        }
        for (const problem of icuProblems(table[k])) {
            icu.push({ key: k, problem })
        }
    }

    // Collisions avec les msgid de Tabby : l'enregistrement se fait avec
    // shouldMerge=true, donc une clé partagée à valeur différente remplace la
    // traduction de Tabby pour TOUTE l'application.
    const clashes = []
    const overrides = []
    const tabby = bundle ? tabbyMessages(bundle, lang) : null
    if (tabby) {
        for (const k of keys) {
            if (!tabby.has(k)) {
                continue
            }
            const theirs = tabby.get(k)
            if (theirs && theirs !== String(table[k])) {
                overrides.push({ key: k, ours: table[k], theirs })
            } else {
                clashes.push(k)
            }
        }
    }

    if (!missing.length && !dead.length && !empty.length && !paramMismatch.length && !icu.length && !overrides.length) {
        const shared = clashes.length ? ` — ${clashes.length} clé(s) partagée(s) avec Tabby, valeurs identiques.` : ''
        if (!tabby && bundle) {
            console.log(`  ${lang} : ${keys.size} clés, complet (msgid de Tabby introuvables, collisions NON VÉRIFIÉES).`)
            continue
        }
        console.log(`  ${lang} : ${keys.size} clés, complet${shared}`)
        continue
    }

    failures++
    console.log(`  ${lang} : ${keys.size} clés.`)
    for (const s of missing) {
        console.log(`    MANQUE    (${sources.get(s)}) ${JSON.stringify(s)}`)
    }
    for (const k of dead) {
        console.log(`    CLÉ MORTE ${JSON.stringify(k)}`)
    }
    for (const k of empty) {
        console.log(`    VIDE      ${JSON.stringify(k)}`)
    }
    for (const p of paramMismatch) {
        const details = [
            p.lost.length ? `perdu(s) : ${p.lost.join(', ')}` : '',
            p.invented.length ? `inventé(s) : ${p.invented.join(', ')}` : '',
        ].filter(Boolean).join(' — ')
        console.log(`    PARAMÈTRE ${details}\n              ${JSON.stringify(p.key)}`)
    }
    for (const p of icu) {
        console.log(`    ICU       ${p.problem}\n              ${JSON.stringify(p.key)}`)
    }
    for (const o of overrides) {
        console.log(`    ÉCRASE TABBY  ${JSON.stringify(o.key)}\n                  Tabby dit ${JSON.stringify(o.theirs)}, nous ${JSON.stringify(o.ours)} — notre valeur gagne pour TOUTE l'application.`)
    }
}

// Les chaînes sources traversent le même compilateur que les traductions.
const sourceIcu = [...sources.keys()].flatMap(s => icuProblems(s).map(problem => ({ s, problem })))
for (const { s, problem } of sourceIcu) {
    console.log(`  source : ICU — ${problem}\n           ${JSON.stringify(s)}`)
    failures++
}

if (failures) {
    console.error(`\n${failures} table(s) à corriger.`)
    process.exitCode = 1
} else if (!process.exitCode) {
    console.log('\nToutes les tables collent aux chaînes sources.')
}
