import './sidebarTree.component.scss'
import FuzzySearch from 'fuzzy-search'
import { merge, Subscription, timer } from 'rxjs'
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop'
import { Component, HostBinding, HostListener, Input, OnDestroy, OnInit } from '@angular/core'
import {
    AppService,
    BaseTabComponent,
    ConfigService,
    NotificationsService,
    PartialProfile,
    PartialProfileGroup,
    Profile,
    ProfileGroup,
    ProfilesService,
    SplitTabComponent,
} from 'tabby-core'
import { SettingsTabComponent } from 'tabby-settings'

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
    contextMenuX = 0
    contextMenuY = 0

    constructor (
        private config: ConfigService,
        private profilesService: ProfilesService,
        private app: AppService,
        private notifications: NotificationsService,
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

    private get favoriteIds (): string[] {
        return this.config.store.sidebarPlus?.favorites ?? []
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
        this.contextMenuGroup = group
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
    }

    closeContextMenu (): void {
        this.contextMenuGroup = null
        this.contextMenuProfile = null
    }

    @HostListener('document:click')
    onDocumentClick (): void {
        this.closeContextMenu()
    }

    ////// PROFILE EDITING (context menu) //////
    onProfileContextMenu (event: MouseEvent, profile: PartialProfile<Profile>): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuProfile = profile
        this.contextMenuX = event.clientX
        this.contextMenuY = event.clientY
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
}
