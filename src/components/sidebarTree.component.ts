import './sidebarTree.component.scss'
import FuzzySearch from 'fuzzy-search'
import { merge, Subscription, timer } from 'rxjs'
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop'
import { Component, HostBinding, HostListener, Inject, Input, OnDestroy, OnInit } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import {
    AppService,
    BaseTabComponent,
    ConfigService,
    NotificationsService,
    PartialProfile,
    PartialProfileGroup,
    Profile,
    ProfileGroup,
    ProfileProvider,
    ProfilesService,
    SplitTabComponent,
} from 'tabby-core'
import { EditProfileModalComponent, SettingsTabComponent } from 'tabby-settings'
import { ICON_ENTRIES, PickerIcon } from '../icons'
import { sanitizeSvgIcon } from '../svgSanitizer'

interface CollapsableProfileGroup extends ProfileGroup {
    collapsed: boolean
    children: PartialProfileGroup<CollapsableProfileGroup>[]
}

type ProfileConnectionStatus = 'connected' | 'error'

/** Duck-typed shape of tabs that carry a launching profile and a live session (e.g. BaseTerminalTabComponent). */
interface ProfileBackedTab {
    profile?: { id?: string }
    session?: unknown
}

@Component({
    selector: 'sidebar-plus-tree',
    template: require('./sidebarTree.component.pug'),
})
export class SidebarPlusTreeComponent implements OnInit, OnDestroy {
    profileGroups: PartialProfileGroup<ProfileGroup>[] = []
    rootGroups: PartialProfileGroup<ProfileGroup>[] = []

    @Input() filter = ''

    panelMinWidth = 200
    panelMaxWidth = 600
    panelInternalWidth = parseInt(window.localStorage.sidebarPlusTreeWidth ?? '300')
    panelStartWidth = this.panelInternalWidth
    panelIsResizing = false
    panelStartX = 0

    profileStatuses = new Map<string, ProfileConnectionStatus>()
    private statusSubscription: Subscription|null = null
    private modalWatchInterval: ReturnType<typeof setInterval>|null = null

    contextMenuGroup: PartialProfileGroup<CollapsableProfileGroup>|null = null
    contextMenuProfile: PartialProfile<Profile>|null = null
    contextMenuRoot = false
    contextMenuX = 0
    contextMenuY = 0
    contextMenuMode: 'menu'|'icon'|'createGroup'|'createProfile'|'confirmDeleteProfile'|'rename' = 'menu'

    newGroupName = ''
    renameValue = ''
    profileTemplates: { provider: ProfileProvider<Profile>, template: PartialProfile<Profile> }[] = []

    // Pug/Angular ends up serializing the template's *ngIf attribute value
    // with double quotes and HTML-entity-escaping any literal `"` inside it
    // (e.g. `contextMenuMode === "icon"` becomes `contextMenuMode === &quot;icon&quot;`
    // in the compiled template string) — comparing against a boolean getter
    // instead of a quoted string literal sidesteps that escaping entirely.
    get isMenuMode (): boolean {
        return this.contextMenuMode === 'menu'
    }

    get isIconPickerMode (): boolean {
        return this.contextMenuMode === 'icon'
    }

    get isCreateGroupMode (): boolean {
        return this.contextMenuMode === 'createGroup'
    }

    get isCreateProfileMode (): boolean {
        return this.contextMenuMode === 'createProfile'
    }

    get isConfirmDeleteProfileMode (): boolean {
        return this.contextMenuMode === 'confirmDeleteProfile'
    }

    get isRenameMode (): boolean {
        return this.contextMenuMode === 'rename'
    }

    iconQuery = ''
    iconMatches: PickerIcon[] = []
    showCustomSvgInput = false
    customSvgText = ''
    customSvgError: string|null = null
    customSvgWarning: string|null = null

    private static readonly MAX_RECENT_ICONS = 5

    constructor (
        private config: ConfigService,
        private profilesService: ProfilesService,
        private app: AppService,
        private notifications: NotificationsService,
        private ngbModal: NgbModal,
        @Inject(ProfileProvider) private profileProviders: ProfileProvider<Profile>[],
    ) { }

    async ngOnInit (): Promise<void> {
        await this.loadTreeItems()
        this.config.changed$.subscribe(() => this.loadTreeItems())

        this.refreshProfileStatuses()
        this.statusSubscription = merge(
            this.app.tabsChanged$,
            this.app.tabOpened$,
            this.app.tabClosed$,
            this.app.tabRemoved$,
            timer(2000, 2000),
        ).subscribe(() => this.refreshProfileStatuses())
    }

    ngOnDestroy (): void {
        this.statusSubscription?.unsubscribe()
        if (this.modalWatchInterval) {
            clearInterval(this.modalWatchInterval)
        }
    }

    private async loadTreeItems (): Promise<void> {
        const profileGroupCollapsed = JSON.parse(window.localStorage.sidebarPlusGroupCollapsed ?? '{}')
        let groups = await this.profilesService.getProfileGroups({ includeNonUserGroup: true, includeProfiles: true })
        // getProfileGroups() does not guarantee a deep clone. buildGroupTree()
        // below assigns a computed `.children` array onto each group object —
        // if those objects are live references into config.store.groups,
        // that computed property gets serialized back into config.yaml on the
        // next config.save(), corrupting it (see roadmap piège #12). Clone
        // defensively so nothing we do here can ever touch Tabby's own state.
        groups = structuredClone(groups)

        for (const group of groups) {
            if (group.profiles?.length) {
                group.profiles = group.profiles.filter(x => !x.isTemplate)
                group.profiles = group.profiles.filter(x => x.id && !this.config.store.profileBlacklist.includes(x.id))
                group.profiles.sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0))
            }
        }

        if (!this.config.store.terminal.showBuiltinProfiles) {
            groups = groups.filter(g => g.id !== 'built-in')
        }
        groups = groups.filter(g => g.id !== 'ungrouped' || (g.profiles?.length ?? 0) > 0)

        const groupOrder: Record<string, string[]> = this.config.store.sidebarPlus?.groupOrder ?? {}
        const groupOrderIndex = (g: PartialProfileGroup<ProfileGroup>): number => {
            const siblingOrder = groupOrder[(g as any).parentGroupId ?? 'root'] ?? []
            const index = siblingOrder.indexOf(g.id)
            return index === -1 ? Number.MAX_SAFE_INTEGER : index
        }
        groups.sort((a, b) => groupOrderIndex(a) - groupOrderIndex(b) || a.name.localeCompare(b.name))
        groups.sort((a, b) => (a.id === 'built-in' || !a.editable ? 1 : 0) - (b.id === 'built-in' || !b.editable ? 1 : 0))
        groups.sort((a, b) => (a.id === 'ungrouped' ? 0 : 1) - (b.id === 'ungrouped' ? 0 : 1))
        this.profileGroups = groups.map(g => SidebarPlusTreeComponent.intoCollapsable(g, profileGroupCollapsed[g.id] ?? false))
        this.rootGroups = this.applyFavorites(this.profilesService.buildGroupTree(this.profileGroups))
    }

    async launchProfile<P extends Profile> (profile: PartialProfile<P>): Promise<any> {
        return this.profilesService.launchProfile(profile)
    }

    async launchProfileFromMenu (profile: PartialProfile<Profile>): Promise<void> {
        this.closeContextMenu()
        await this.launchProfile(profile)
    }

    /**
     * Minimal version: launches the group's direct profiles only, each in
     * its own tab, no split panes, no recursion into sub-groups. The richer
     * behaviour (layout choice, synced multi-input) is deliberately left to
     * the separate "Group Exec" roadmap item — see ROADMAP.html.
     */
    async launchGroupSessions (group: PartialProfileGroup<CollapsableProfileGroup>): Promise<void> {
        this.closeContextMenu()
        const profiles = group.profiles ?? []
        if (!profiles.length) {
            this.notifications.notice('Ce dossier ne contient aucun profil à lancer')
            return
        }
        await Promise.all(profiles.map(profile => this.launchProfile(profile)))
    }

    async onFilterChange (): Promise<void> {
        const q = this.filter.trim().toLowerCase()

        if (q.length === 0) {
            this.rootGroups = this.applyFavorites(this.profilesService.buildGroupTree(this.profileGroups))
            return
        }

        const profiles = await this.profilesService.getProfiles({
            includeBuiltin: this.config.store.terminal.showBuiltinProfiles,
            clone: true,
        })

        const matches = new FuzzySearch(
            profiles.filter(p => !p.isTemplate),
            ['name', 'description'],
            { sort: false },
        ).search(q)

        this.rootGroups = [
            {
                id: 'search',
                editable: false,
                name: 'Filter results',
                icon: 'fas fa-magnifying-glass',
                profiles: matches,
            },
        ]
    }

    ////// RESIZING //////
    startResize (event: MouseEvent): void {
        this.panelIsResizing = true
        this.panelStartX = event.clientX
        this.panelStartWidth = this.panelWidth
        event.preventDefault()
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove (event: MouseEvent): void {
        if (!this.panelIsResizing) { return }
        const delta = event.clientX - this.panelStartX
        const width = Math.min(Math.max(this.panelMinWidth, this.panelStartWidth + delta), this.panelMaxWidth)
        this.panelWidth = width
        window.localStorage.sidebarPlusTreeWidth = width.toString()
    }

    @HostListener('document:mouseup')
    stopResize (): boolean {
        this.panelIsResizing = false
        return true
    }

    @HostBinding('style.width.px')
    get panelWidth (): number {
        return this.panelInternalWidth
    }

    set panelWidth (value: number) {
        this.panelInternalWidth = value
    }

    ////// GROUP COLLAPSING //////
    toggleGroupCollapse (group: PartialProfileGroup<CollapsableProfileGroup>): void {
        group.collapsed = !group.collapsed
        const profileGroupCollapsed = JSON.parse(window.localStorage.sidebarPlusGroupCollapsed ?? '{}')
        profileGroupCollapsed[group.id] = group.collapsed
        window.localStorage.sidebarPlusGroupCollapsed = JSON.stringify(profileGroupCollapsed)
    }

    private static intoCollapsable (group: PartialProfileGroup<ProfileGroup>, collapsed: boolean): PartialProfileGroup<CollapsableProfileGroup> {
        return { ...group, collapsed } as PartialProfileGroup<CollapsableProfileGroup>
    }

    ////// FAVORITES //////
    isFavorite (profile: PartialProfile<Profile>): boolean {
        return !!profile.id && this.favoriteIds.includes(profile.id)
    }

    toggleFavorite (profile: PartialProfile<Profile>, event: Event): void {
        event.preventDefault()
        event.stopPropagation()
        if (!profile.id) {
            return
        }
        this.config.store.sidebarPlus ??= {}
        const favorites: string[] = this.config.store.sidebarPlus.favorites ?? []
        const index = favorites.indexOf(profile.id)
        if (index === -1) {
            favorites.push(profile.id)
        } else {
            favorites.splice(index, 1)
        }
        this.config.store.sidebarPlus.favorites = favorites
        this.config.save()
        this.rootGroups = this.applyFavorites(this.rootGroups.filter(g => g.id !== 'favorites'))
    }

    toggleFavoriteFromMenu (profile: PartialProfile<Profile>, event: Event): void {
        this.toggleFavorite(profile, event)
        this.closeContextMenu()
    }

    private get favoriteIds (): string[] {
        return this.config.store.sidebarPlus?.favorites ?? []
    }

    ////// GROUP FAVORITES //////
    // Separate config key from profile favorites: profile IDs and group IDs
    // don't share a documented namespace guarantee, so a combined list would
    // risk a collision that's unlikely but avoidable at zero cost.
    isFavoriteGroup (group: PartialProfileGroup<ProfileGroup>): boolean {
        return this.favoriteGroupIds.includes(group.id)
    }

    toggleFavoriteGroupFromMenu (group: PartialProfileGroup<CollapsableProfileGroup>, event: Event): void {
        event.preventDefault()
        event.stopPropagation()
        this.config.store.sidebarPlus ??= {}
        const favoriteGroups: string[] = this.config.store.sidebarPlus.favoriteGroups ?? []
        const index = favoriteGroups.indexOf(group.id)
        if (index === -1) {
            favoriteGroups.push(group.id)
        } else {
            favoriteGroups.splice(index, 1)
        }
        this.config.store.sidebarPlus.favoriteGroups = favoriteGroups
        this.config.save()
        this.closeContextMenu()
    }

    private get favoriteGroupIds (): string[] {
        return this.config.store.sidebarPlus?.favoriteGroups ?? []
    }

    private applyFavorites (
        groups: PartialProfileGroup<CollapsableProfileGroup>[],
    ): PartialProfileGroup<CollapsableProfileGroup>[] {
        const favoriteIds = this.favoriteIds
        if (!favoriteIds.length) {
            return groups
        }

        const allProfiles = this.profileGroups.flatMap(g => g.profiles ?? [])
        const favoriteProfiles = favoriteIds
            .map(id => allProfiles.find(p => p.id === id))
            .filter((p): p is PartialProfile<Profile> => !!p)

        if (!favoriteProfiles.length) {
            return groups
        }

        const favoritesGroup = SidebarPlusTreeComponent.intoCollapsable(
            {
                id: 'favorites',
                name: 'Épinglés',
                icon: 'fas fa-star',
                editable: false,
                profiles: favoriteProfiles,
            } as PartialProfileGroup<ProfileGroup>,
            false,
        )

        return [favoritesGroup, ...groups]
    }

    ////// LIVE CONNECTION STATUS //////
    getProfileStatus (profile: PartialProfile<Profile>): ProfileConnectionStatus|null {
        return (profile.id && this.profileStatuses.get(profile.id)) || null
    }

    private refreshProfileStatuses (): void {
        const statuses = new Map<string, ProfileConnectionStatus>()
        for (const tab of this.getAllOpenTabs() as unknown as ProfileBackedTab[]) {
            const profileId = tab.profile?.id
            if (!profileId) {
                continue
            }
            if (tab.session) {
                statuses.set(profileId, 'connected')
            } else if (!statuses.has(profileId)) {
                statuses.set(profileId, 'error')
            }
        }
        this.profileStatuses = statuses
    }

    private getAllOpenTabs (): BaseTabComponent[] {
        return this.app.tabs.flatMap(tab => tab instanceof SplitTabComponent ? tab.getAllTabs() : [tab])
    }

    ////// DRAG & DROP //////
    get profileListIds (): string[] {
        return this.profileGroups.map(g => `profiles-${g.id}`)
    }

    async onProfileDrop (
        event: CdkDragDrop<PartialProfile<Profile>[]>,
        targetGroup: PartialProfileGroup<ProfileGroup>,
    ): Promise<void> {
        const isRealTarget = targetGroup.editable || targetGroup.id === 'ungrouped'
        if (!isRealTarget) {
            return
        }

        if (event.previousContainer === event.container) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex)
        } else {
            const profile = event.previousContainer.data[event.previousIndex]
            transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex)
            profile.group = targetGroup.id === 'ungrouped' ? undefined : targetGroup.id
            await this.profilesService.writeProfile(profile)
            await this.persistProfileWeights(event.previousContainer.data)
        }
        await this.persistProfileWeights(event.container.data)
        this.config.save()
    }

    private async persistProfileWeights (profiles: PartialProfile<Profile>[]): Promise<void> {
        await Promise.all(profiles.map((profile, index) => {
            if ((profile.weight ?? 0) === index) {
                return Promise.resolve()
            }
            profile.weight = index
            return this.profilesService.writeProfile(profile)
        }))
    }

    get groupListIds (): string[] {
        return ['groups-root', ...this.profileGroups.map(g => `groups-${g.id}`)]
    }

    async onGroupDrop (
        event: CdkDragDrop<PartialProfileGroup<CollapsableProfileGroup>[]>,
        targetParentGroupId: string|null,
    ): Promise<void> {
        const dragged = event.previousContainer.data[event.previousIndex]
        if (!dragged.editable) {
            return
        }

        if (event.previousContainer === event.container) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex)
            this.persistGroupOrder(targetParentGroupId, event.container.data)
            await this.config.save()
            return
        }

        if (targetParentGroupId) {
            const targetParent = this.profileGroups.find(g => g.id === targetParentGroupId)
            if (!targetParent?.editable || this.isSelfOrDescendant(targetParentGroupId, dragged.id)) {
                return
            }
        }

        transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex)
        try {
            await this.reparentGroup(dragged, targetParentGroupId)
        } catch (err) {
            this.notifications.error('Le déplacement du dossier a échoué', String(err))
            throw err
        }
        this.persistGroupOrder(targetParentGroupId, event.container.data)
        await this.config.save()
    }

    private persistGroupOrder (parentGroupId: string|null, groups: PartialProfileGroup<CollapsableProfileGroup>[]): void {
        this.config.store.sidebarPlus ??= {}
        this.config.store.sidebarPlus.groupOrder ??= {}
        this.config.store.sidebarPlus.groupOrder[parentGroupId ?? 'root'] = groups
            .filter(g => g.editable)
            .map(g => g.id)
    }

    /**
     * profilesService.writeProfileGroup() only updates an existing flat
     * top-level config.store.groups entry — it cannot relocate a group
     * between parents (see roadmap piège #12: a naive parentGroupId
     * reassignment corrupted real user data). Instead, recreate an
     * equivalent group under the new parent, migrate its profiles and child
     * groups into it one at a time (writeProfile/newProfileGroup/
     * deleteProfileGroup are all already proven safe), then delete the
     * now-empty original.
     */
    private async reparentGroup (
        group: PartialProfileGroup<CollapsableProfileGroup>,
        newParentGroupId: string|null,
    ): Promise<void> {
        const replacement = {
            id: '',
            name: group.name,
            icon: group.icon,
            color: group.color,
            parentGroupId: newParentGroupId ?? undefined,
        } as PartialProfileGroup<ProfileGroup>
        await this.profilesService.newProfileGroup(replacement, { genId: true })

        for (const profile of group.profiles ?? []) {
            profile.group = replacement.id
            await this.profilesService.writeProfile(profile)
        }
        for (const child of group.children ?? []) {
            await this.reparentGroup(child, replacement.id)
        }
        await this.profilesService.deleteProfileGroup(group)
    }

    /** True if `candidateId` is `ancestorId` itself or nested somewhere under it (used to block re-parenting a group into its own subtree). */
    private isSelfOrDescendant (candidateId: string, ancestorId: string): boolean {
        let current = this.profileGroups.find(g => g.id === candidateId)
        while (current) {
            if (current.id === ancestorId) {
                return true
            }
            current = current.parentGroupId ? this.profileGroups.find(g => g.id === current!.parentGroupId) : undefined
        }
        return false
    }

    ////// GROUP DELETION (context menu) //////
    onGroupContextMenu (event: MouseEvent, group: PartialProfileGroup<CollapsableProfileGroup>): void {
        event.preventDefault()
        event.stopPropagation()
        if (!group.editable) {
            return
        }
        this.contextMenuProfile = null
        this.contextMenuGroup = group
        this.contextMenuRoot = false
        this.contextMenuMode = 'menu'
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
    }

    /** Right-click on empty sidebar space (not on any group/profile row) — offers root-level creation. */
    onSidebarContextMenu (event: MouseEvent): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuGroup = null
        this.contextMenuProfile = null
        this.contextMenuRoot = true
        this.contextMenuMode = 'menu'
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
    }

    closeContextMenu (): void {
        this.contextMenuGroup = null
        this.contextMenuProfile = null
        this.contextMenuRoot = false
        this.contextMenuMode = 'menu'
    }

    // Checks the click's target rather than relying on descendant
    // (click)='$event.stopPropagation()' bindings to suppress this — those
    // bindings don't reliably stop this HostListener('document:click') from
    // firing regardless (observed via console.trace: it runs synchronously
    // right after a menu item's own click handler, even for items whose
    // ancestor .group-context-menu has a stopPropagation click binding).
    @HostListener('document:click', ['$event'])
    onDocumentClick (event: MouseEvent): void {
        if ((event.target as HTMLElement).closest('.group-context-menu, .icon-picker, .create-popup')) {
            return
        }
        this.closeContextMenu()
    }

    ////// RENAME (context menu, inline — no modal) //////
    openRenamePrompt (): void {
        this.renameValue = this.contextMenuProfile?.name ?? this.contextMenuGroup?.name ?? ''
        this.contextMenuMode = 'rename'
    }

    async confirmRename (): Promise<void> {
        const name = this.renameValue.trim()
        if (!name) {
            return
        }
        if (this.contextMenuProfile) {
            this.contextMenuProfile.name = name
            await this.profilesService.writeProfile(this.contextMenuProfile)
        } else if (this.contextMenuGroup) {
            // Minimal {id, name} object only — see applyIcon() above for why
            // (never pass contextMenuGroup itself, it carries plugin-computed
            // fields that writeProfileGroup() would Object.assign() straight
            // into config.yaml, roadmap piège #12).
            await this.profilesService.writeProfileGroup({ id: this.contextMenuGroup.id, name } as PartialProfileGroup<ProfileGroup>)
        } else {
            return
        }
        await this.config.save()
        this.closeContextMenu()
    }

    ////// GROUP / PROFILE CREATION (context menu) //////
    openCreateGroupPrompt (): void {
        this.contextMenuMode = 'createGroup'
        this.newGroupName = ''
    }

    async createGroup (): Promise<void> {
        const name = this.newGroupName.trim()
        if (!name) {
            return
        }
        const parentGroupId = this.contextMenuGroup?.id
        await this.profilesService.newProfileGroup({ name, parentGroupId } as PartialProfileGroup<ProfileGroup>, { genId: true })
        await this.config.save()
        this.closeContextMenu()
    }

    async openCreateProfilePicker (): Promise<void> {
        this.contextMenuMode = 'createProfile'
        const perProvider = await Promise.all(this.profileProviders.map(async provider => ({
            provider,
            templates: (await provider.getBuiltinProfiles()).filter(p => p.isTemplate),
        })))
        this.profileTemplates = perProvider.flatMap(({ provider, templates }) => templates.map(template => ({ provider, template })))
    }

    async pickProfileTemplate (entry: { provider: ProfileProvider<Profile>, template: PartialProfile<Profile> }): Promise<void> {
        const groupId = this.contextMenuGroup?.id
        const base = structuredClone(entry.template) as PartialProfile<Profile> & { isTemplate?: boolean, isBuiltin?: boolean, weight?: number }
        delete base.isTemplate
        delete base.isBuiltin
        delete base.weight
        base.group = groupId
        this.closeContextMenu()

        const modal = this.ngbModal.open(EditProfileModalComponent, { size: 'lg' })
        modal.componentInstance.partialProfile = base
        modal.componentInstance.profileProvider = entry.provider

        const result = await modal.result.catch(() => null) as PartialProfile<Profile>|null
        if (!result) {
            return
        }
        result.type = entry.provider.id
        if (!result.name) {
            const cfgProxy = this.profilesService.getConfigProxyForProfile(result)
            result.name = entry.provider.getSuggestedName(cfgProxy) ?? entry.provider.name
        }
        await this.profilesService.newProfile(result)
        await this.config.save()
    }

    ////// PROFILE EDITING (context menu) //////
    onProfileContextMenu (event: MouseEvent, profile: PartialProfile<Profile>): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuGroup = null
        this.contextMenuProfile = profile
        this.contextMenuRoot = false
        this.contextMenuMode = 'menu'
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
    }

    ////// ICON PICKER (context menu) //////
    openIconPicker (): void {
        this.contextMenuMode = 'icon'
        this.iconQuery = ''
        this.iconMatches = []
        this.showCustomSvgInput = false
        this.customSvgText = ''
        this.customSvgError = null
        this.customSvgWarning = null
    }

    get recentIcons (): string[] {
        return this.config.store.sidebarPlus?.recentIcons ?? []
    }

    onIconQueryChange (): void {
        const q = this.iconQuery.trim().toLowerCase()
        this.iconMatches = q ? ICON_ENTRIES.filter(e => e.name.includes(q)).slice(0, 40) : []
    }

    toggleCustomSvgInput (): void {
        this.showCustomSvgInput = !this.showCustomSvgInput
    }

    async selectIconClass (iconClass: string): Promise<void> {
        await this.applyIcon(iconClass)
    }

    async applyCustomSvg (): Promise<void> {
        const result = sanitizeSvgIcon(this.customSvgText)
        if (!result.ok || !result.svg) {
            this.customSvgError = result.error ?? 'SVG rejeté.'
            this.customSvgWarning = null
            return
        }
        this.customSvgError = null
        this.customSvgWarning = result.warning ?? null
        await this.applyIcon(result.svg)
    }

    private async applyIcon (icon: string): Promise<void> {
        if (this.contextMenuProfile) {
            const profile = this.contextMenuProfile
            profile.icon = icon
            await this.profilesService.writeProfile(profile)
        } else if (this.contextMenuGroup) {
            // Only ever pass a minimal {id, icon} object here, never
            // contextMenuGroup itself — it carries the plugin-computed
            // `.children`/`.collapsed` fields, and writeProfileGroup()
            // Object.assign()s whatever it's given onto the live config
            // object (see roadmap piège #12: that's exactly how a past bug
            // leaked computed fields into config.yaml).
            await this.profilesService.writeProfileGroup({ id: this.contextMenuGroup.id, icon } as PartialProfileGroup<ProfileGroup>)
        } else {
            return
        }
        this.recordRecentIcon(icon)
        await this.config.save()
        this.closeContextMenu()
    }

    private recordRecentIcon (icon: string): void {
        this.config.store.sidebarPlus ??= {}
        const recent: string[] = (this.config.store.sidebarPlus.recentIcons ?? []).filter((i: string) => i !== icon)
        recent.unshift(icon)
        this.config.store.sidebarPlus.recentIcons = recent.slice(0, SidebarPlusTreeComponent.MAX_RECENT_ICONS)
    }

    /**
     * There is no public API to open the profile edit modal directly (it's
     * EditProfileModalComponent, marked @hidden and not exported by
     * tabby-settings — same situation as the native profile-tree component).
     * Falls back to: open Settings > Profiles (SettingsTabComponent IS
     * exported, takes an `activeTab` input for this), then drive the native
     * DOM to expand every collapsed group and click the target profile's
     * row directly — which is what actually opens the native edit modal
     * (there's no separate "Edit" button; the dropdown only has
     * Duplicate/Hide/Delete). If we're the ones who opened a brand-new
     * Settings tab for this (as opposed to reusing one the user already had
     * open), automatically close it and return to the previous tab once the
     * modal closes, with a toast confirming. This last part depends on
     * tabby-settings' internal, unversioned DOM structure — see roadmap
     * "Points fragiles à revérifier après une mise à jour de Tabby".
     */
    async openProfileSettings (profile?: PartialProfile<Profile>): Promise<void> {
        const previousTab = this.app.activeTab
        const existingSettingsTab = this.app.tabs.find(t => t instanceof SettingsTabComponent) as SettingsTabComponent|undefined
        let settingsTab: BaseTabComponent
        let weOpenedTab = false
        if (existingSettingsTab) {
            existingSettingsTab.activeTab = 'profiles'
            this.app.selectTab(existingSettingsTab)
            settingsTab = existingSettingsTab
        } else {
            settingsTab = this.app.openNewTabRaw({ type: SettingsTabComponent, inputs: { activeTab: 'profiles' } })
            weOpenedTab = true
        }
        this.closeContextMenu()

        if (!profile) {
            return
        }
        const modalOpened = await this.clickNativeProfileRow(profile.name)
        if (modalOpened && weOpenedTab) {
            this.watchForNativeModalClose(settingsTab, previousTab)
        }
    }

    /** Expands every collapsed group in the native profiles list (`fa-folder` = collapsed, `fa-folder-open` = expanded), then clicks the target profile's row. Returns whether the edit modal actually opened. */
    private async clickNativeProfileRow (profileName: string): Promise<boolean> {
        await this.wait(400)

        for (let pass = 0; pass < 10; pass++) {
            const collapsed = Array.from(document.querySelectorAll<HTMLElement>('.collapse-item'))
                .filter(row => row.querySelector('.fa-folder:not(.fa-folder-open)'))
            if (!collapsed.length) {
                break
            }
            collapsed.forEach(row => row.click())
            await this.wait(150)
        }

        const row = Array.from(document.querySelectorAll<HTMLElement>('.collapse-item'))
            .find(r => r.querySelector('span')?.textContent?.trim() === profileName)
        row?.click()
        if (!row) {
            return false
        }
        await this.wait(300)
        return !!document.querySelector('.modal-content')
    }

    /** Polls for the native edit modal to close, then closes the Settings tab we opened and returns to the previously active one. */
    private watchForNativeModalClose (settingsTab: BaseTabComponent, previousTab: BaseTabComponent|null): void {
        if (this.modalWatchInterval) {
            clearInterval(this.modalWatchInterval)
        }
        let sawModal = false
        let elapsedMs = 0
        this.modalWatchInterval = setInterval(() => {
            elapsedMs += 300
            const modalPresent = !!document.querySelector('.modal-content')
            if (modalPresent) {
                sawModal = true
                return
            }
            if (sawModal || elapsedMs > 10 * 60 * 1000) {
                if (this.modalWatchInterval) {
                    clearInterval(this.modalWatchInterval)
                    this.modalWatchInterval = null
                }
                if (!sawModal) {
                    return
                }
                this.app.closeTab(settingsTab)
                if (previousTab) {
                    this.app.selectTab(previousTab)
                }
                this.notifications.notice('Retour à votre session précédente')
            }
        }, 300)
    }

    private wait (ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    async deleteGroup (group: PartialProfileGroup<CollapsableProfileGroup>): Promise<void> {
        const childCount = group.children?.length ?? 0
        const profileCount = group.profiles?.length ?? 0
        if (childCount || profileCount) {
            const reasons: string[] = []
            if (childCount) {
                reasons.push(`${childCount} sous-dossier${childCount > 1 ? 's' : ''}`)
            }
            if (profileCount) {
                reasons.push(`${profileCount} profil${profileCount > 1 ? 's' : ''}`)
            }
            this.notifications.error(
                `Impossible de supprimer "${group.name}"`,
                `Ce dossier contient encore ${reasons.join(' et ')}. Videz-le d'abord.`,
            )
            this.closeContextMenu()
            return
        }
        await this.profilesService.deleteProfileGroup(group)
        this.config.save()
        this.closeContextMenu()
    }

    ////// PROFILE DELETION (context menu) //////
    confirmDeleteProfile (): void {
        this.contextMenuMode = 'confirmDeleteProfile'
    }

    async deleteProfile (profile: PartialProfile<Profile>): Promise<void> {
        await this.profilesService.deleteProfile(profile)
        await this.config.save()
        this.closeContextMenu()
    }
}
