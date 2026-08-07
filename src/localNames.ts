import * as fs from 'fs'
import * as path from 'path'

/**
 * A path in `folder` that nothing occupies, suffixed the way Explorer does.
 *
 * Checked with `fs` rather than remembered: the folder belongs to the user,
 * and anything may have appeared in it between the choice and this call.
 * Shared by every route that writes into a folder of the user's choosing —
 * the drop delivery and the context menu's directory download — so the two
 * cannot drift apart on how a collision is avoided.
 */
export function freeLocalName (folder: string, name: string): string {
    let candidate = path.join(folder, name)
    if (!fs.existsSync(candidate)) {
        return candidate
    }
    const extension = path.extname(name)
    const base = name.slice(0, name.length - extension.length)
    for (let n = 2; ; n++) {
        candidate = path.join(folder, `${base} (${n})${extension}`)
        if (!fs.existsSync(candidate)) {
            return candidate
        }
    }
}
