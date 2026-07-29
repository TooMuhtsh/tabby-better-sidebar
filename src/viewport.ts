/**
 * Nudges a floating element back inside the window.
 *
 * The single point every context menu and popup in this plugin goes through —
 * see piège #30. It lives here rather than as a private static on
 * SidebarPlusTreeComponent because the SFTP browser needs it too, and a second
 * copy is exactly how one of them ends up quietly not being fixed.
 *
 * Call it *after* Angular has rendered the element at its real size
 * (ngAfterViewChecked + a dirty flag), not when the coordinates are first set:
 * before rendering, getBoundingClientRect() reports the size of whatever the
 * element used to be, or nothing at all.
 */
export function clampInViewport (el: HTMLElement, x: number, y: number): { x: number, y: number } {
    const rect = el.getBoundingClientRect()
    const margin = 4
    const maxX = Math.max(margin, window.innerWidth - rect.width - margin)
    const maxY = Math.max(margin, window.innerHeight - rect.height - margin)
    return {
        x: Math.max(margin, Math.min(x, maxX)),
        y: Math.max(margin, Math.min(y, maxY)),
    }
}
