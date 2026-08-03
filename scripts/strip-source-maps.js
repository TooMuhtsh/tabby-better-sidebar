// Removes every source map left in dist/ before publication.
//
// `devtool` is already false in production (webpack.config.js), so a clean
// build emits none — this exists for the far more common case: a development
// build ran first (it is what `npm run build` and the NTFS junction use), left
// index.js.map and icon-sets.index.js.map behind, and `files: ["dist"]` would
// have shipped both. webpack's own `output.clean` cannot do this job: the .d.ts
// files `typings` points at are written straight to dist/ by TypeScript, not
// emitted as webpack assets, so cleaning would collect them as strays.

const fs = require('fs')
const path = require('path')

const dist = path.join(__dirname, '..', 'dist')

let removed = 0

function walk (dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            walk(full)
        } else if (entry.name.endsWith('.map')) {
            fs.rmSync(full)
            removed++
        }
    }
}

if (fs.existsSync(dist)) {
    walk(dist)
}

console.log(`strip-source-maps: ${removed} removed`)
