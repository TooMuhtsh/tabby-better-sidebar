import './iconPickerModal.component.scss'
import { AfterViewChecked, Component, HostListener, Input } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, PartialProfile, PartialProfileGroup, Profile, ProfileGroup, ProfilesService } from 'tabby-core'
import { loadIconEntries, PickerIcon } from '../icons'
import { sanitizeSvgIcon } from '../svgSanitizer'
import { SidebarPlusNoticesService } from '../notices.service'
import { SidebarWorkspace } from '../configProvider'
import { SidebarPlusI18nService } from '../i18n'
import { TranslatableMessage } from '../i18nMessage'
import { clampInViewport } from '../viewport'

/**
 * The icon picker — favorites, recents, search across the vendored icon sets
 * (including dashboard-icons' light/dark variants), a custom-SVG import, and
 * the per-tile favorite toggle — opened on a profile, a folder, or a
 * workspace, always exactly one of the three.
 *
 * A modal rather than the popup this started as, for the same reason as the
 * snippets and note editors: a search field, several scrolling grids and a
 * multi-line SVG field are a poor fit for a 260px box anchored to the cursor.
 * It used to carry its own positioning, screen-edge clamp and click-outside
 * handling for its per-tile favorite menu; the first two are moot once
 * NgbModal owns the box, and the favorite menu keeps only what a *nested*
 * floating element still needs — see iconMenuPositionDirty below.
 *
 * Deliberately loads nothing on open: `loadIconEntries()` is only awaited
 * from `onIconQueryChange()`, exactly as it was in the popup, so the 5MB
 * icon-set chunk still loads on the first search rather than on every open.
 */
@Component({
    selector: 'sidebar-plus-icon-picker-modal',
    template: require('./iconPickerModal.component.pug'),
})
export class IconPickerModalComponent implements AfterViewChecked {
    /** Exactly one of the three is set, matching whichever menu opened the picker. */
    @Input() profile: PartialProfile<Profile>|null = null
    @Input() group: PartialProfileGroup<ProfileGroup>|null = null
    @Input() workspace: SidebarWorkspace|null = null

    iconQuery = ''
    iconMatches: PickerIcon[] = []
    showCustomSvgInput = false
    customSvgText = ''
    customSvgError: string|null = null

    ////// FAVORITE-TOGGLE MENU (per tile, right click) //////
    /** The icon a right-click opened the pin/unpin menu on, or null. */
    iconMenuIcon: string|null = null
    iconMenuX = 0
    iconMenuY = 0
    /** Set on open/move — checked once in ngAfterViewChecked(), same pattern as the tree's own popups (the DOM must have rendered the menu at its real size first). */
    private iconMenuPositionDirty = false

    private static readonly MAX_RECENT_ICONS = 20

    constructor (
        private config: ConfigService,
        private profilesService: ProfilesService,
        private modalInstance: NgbActiveModal,
        private i18n: SidebarPlusI18nService,
        private notices: SidebarPlusNoticesService,
    ) { }

    ngAfterViewChecked (): void {
        if (!this.iconMenuPositionDirty) {
            return
        }
        this.iconMenuPositionDirty = false
        setTimeout(() => {
            const menu = document.querySelector<HTMLElement>('.icon-context-menu')
            if (!menu) {
                return
            }
            const { x, y } = clampInViewport(menu, this.iconMenuX, this.iconMenuY)
            this.iconMenuX = x
            this.iconMenuY = y
            menu.style.left = `${x}px`
            menu.style.top = `${y}px`
        })
    }

    private tMsg (msg: TranslatableMessage): string {
        return this.i18n.t(msg.message, msg.params)
    }

    get recentIcons (): string[] {
        return this.config.store.sidebarPlus?.recentIcons ?? []
    }

    ////// FAVORITES //////
    // Permanent counterpart to recentIcons: an entry stays until explicitly
    // unpinned, where "Récentes" is a usage trail that evicts its oldest
    // entry past MAX_RECENT_ICONS. Not workspace-scoped — an icon is a
    // rendering choice, not part of what a workspace shows or hides.
    get favoriteIcons (): string[] {
        return this.config.store.sidebarPlus?.favoriteIcons ?? []
    }

    isFavoriteIcon (icon: string): boolean {
        return this.favoriteIcons.includes(icon)
    }

    /**
     * Right-click on an icon tile. Its own open-state and its own
     * coordinates, kept apart from the modal's dismiss/close flow — closing
     * the picker itself must not be tangled with pinning a favorite.
     */
    onIconContextMenu (event: MouseEvent, icon: string): void {
        event.preventDefault()
        event.stopPropagation()
        this.iconMenuIcon = icon
        this.iconMenuX = event.clientX
        this.iconMenuY = event.clientY
        this.iconMenuPositionDirty = true
    }

    closeIconMenu (): void {
        this.iconMenuIcon = null
    }

    /**
     * Closes the favorite-toggle menu on any click outside it — including a
     * click elsewhere in the picker itself, which must survive (it is what
     * the menu acts upon). Checked on the click's target rather than a
     * descendant `(click)='$event.stopPropagation()'` binding, same reason
     * as the tree's own popups: those bindings don't reliably stop a
     * `document:click` listener from firing regardless (piège #15).
     */
    @HostListener('document:click', ['$event'])
    onDocumentClick (event: MouseEvent): void {
        if (!(event.target as HTMLElement).closest('.icon-context-menu')) {
            this.closeIconMenu()
        }
    }

    toggleFavoriteIconFromMenu (event: Event): void {
        if (this.iconMenuIcon) {
            this.toggleFavoriteIcon(this.iconMenuIcon, event)
        }
        this.closeIconMenu()
    }

    toggleFavoriteIcon (icon: string, event: Event): void {
        event.preventDefault()
        event.stopPropagation()
        this.config.store.sidebarPlus ??= {}
        const favorites: string[] = [...this.favoriteIcons]
        const index = favorites.indexOf(icon)
        if (index === -1) {
            favorites.push(icon)
        } else {
            favorites.splice(index, 1)
        }
        // Explicit reassignment, like every other write in this plugin — a
        // nested in-place mutation is never picked up as a change to persist
        // (piège #23).
        this.config.store.sidebarPlus.favoriteIcons = favorites
        this.config.save()
    }

    async onIconQueryChange (): Promise<void> {
        const q = this.iconQuery.trim().toLowerCase()
        if (!q) {
            this.iconMatches = []
            return
        }
        const entries = await loadIconEntries()
        // The icon sets load once, so only the very first search can await
        // anything — but that one await is long enough (5 MB of JSON to
        // decode and sort) for the user to keep typing, or to close the
        // picker. Drop the result if the query has moved on, otherwise a
        // stale list would overwrite the current one.
        if (this.iconQuery.trim().toLowerCase() !== q) {
            return
        }
        this.iconMatches = entries
            .filter(e => e.name.includes(q) || e.searchTerms?.some(t => t.includes(q)))
            .slice(0, 40)
    }

    toggleCustomSvgInput (): void {
        this.showCustomSvgInput = !this.showCustomSvgInput
    }

    async selectIconClass (iconClass: string): Promise<void> {
        await this.applyIcon(iconClass)
    }

    /**
     * A tile's small variant dots (dashboard-icons' light/dark palettes, see
     * icons.ts) — deliberately its own handler rather than reusing
     * selectIconClass() with a different argument, so the click can be
     * stopped from also bubbling into the tile's own (click), which would
     * immediately re-apply the tile's *default* variant right after this
     * one.
     */
    async selectIconVariant (value: string, event: Event): Promise<void> {
        event.preventDefault()
        event.stopPropagation()
        await this.applyIcon(value)
    }

    async applyCustomSvg (): Promise<void> {
        const result = sanitizeSvgIcon(this.customSvgText)
        if (!result.ok || !result.svg) {
            this.customSvgError = result.error ? this.tMsg(result.error) : this.i18n.t('SVG rejected.')
            return
        }
        this.customSvgError = null
        if (result.warning) {
            // A toast, not a line in the modal: applyIcon() closes the modal,
            // which took the inline warning with it before it could be read.
            this.notices.notice(this.tMsg(result.warning))
        }
        await this.applyIcon(result.svg)
    }

    private async applyIcon (icon: string): Promise<void> {
        if (this.profile) {
            const profile = this.profile
            profile.icon = icon
            await this.profilesService.writeProfile(profile)
        } else if (this.group) {
            // Only ever pass a minimal {id, icon} object here, never `group`
            // itself — it may carry plugin-computed fields (the tree's own
            // `.children`/`.collapsed`), and writeProfileGroup() Object.assign()s
            // whatever it's given onto the live config object (roadmap piège
            // #12: that's exactly how a past bug leaked computed fields into
            // config.yaml).
            await this.profilesService.writeProfileGroup({ id: this.group.id, icon } as PartialProfileGroup<ProfileGroup>)
        } else if (this.workspace) {
            // Find the live entry in the stored array and mutate it in
            // place, then reassign the array itself (piège #23 — a nested
            // in-place mutation alone never persists).
            this.config.store.sidebarPlus ??= {}
            const workspaces: SidebarWorkspace[] = this.config.store.sidebarPlus.workspaces ?? []
            const target = workspaces.find(w => w.id === this.workspace!.id)
            if (target) {
                target.icon = icon
            }
            this.config.store.sidebarPlus.workspaces = workspaces
        } else {
            return
        }
        this.recordRecentIcon(icon)
        await this.config.save()
        this.modalInstance.close()
    }

    /** Offered only for a workspace — folders/profiles have no equivalent "back to no icon" entry to mirror (see the *ngIf gating it in the template). */
    async clearWorkspaceIcon (): Promise<void> {
        if (!this.workspace) {
            return
        }
        this.config.store.sidebarPlus ??= {}
        const workspaces: SidebarWorkspace[] = this.config.store.sidebarPlus.workspaces ?? []
        const target = workspaces.find(w => w.id === this.workspace!.id)
        if (target) {
            delete target.icon
        }
        this.config.store.sidebarPlus.workspaces = workspaces
        await this.config.save()
        this.modalInstance.close()
    }

    private recordRecentIcon (icon: string): void {
        this.config.store.sidebarPlus ??= {}
        const recent: string[] = (this.config.store.sidebarPlus.recentIcons ?? []).filter((i: string) => i !== icon)
        recent.unshift(icon)
        this.config.store.sidebarPlus.recentIcons = recent.slice(0, IconPickerModalComponent.MAX_RECENT_ICONS)
    }

    close (): void {
        this.modalInstance.dismiss()
    }
}
