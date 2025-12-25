import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    ActivityIcon,
    ArchiveIcon,
    ChevronLeftIcon,
    DownloadIcon,
    LucideAngularModule,
    PaletteIcon,
    UploadIcon,
    UsersIcon,
    XIcon,
    PencilIcon,
    CheckIcon
} from 'lucide-angular';
import { BoardStore } from '../../store/board-store.service';
import { ListsService } from '../../data/lists.service';
import { CardsService } from '../../data/cards.service';
import { BoardMemberLite, BoardsService, MemberRole } from '../../data/boards.service';
import { Activity, Card, ListDto } from '../../types';
import { ActivityService } from '../../data/activity.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { WorkspacesService, WorkspaceMember } from '../../data/workspaces.service';
import { Router } from '@angular/router';

@Component({
    standalone: true,
    selector: 'board-menu',
    imports: [CommonModule, LucideAngularModule, FormsModule],
    templateUrl: './board-menu.component.html',
    styleUrls: ['./board-menu.component.css']
})
export class BoardMenuComponent {
    store = inject(BoardStore);
    listsApi = inject(ListsService);
    cardsApi = inject(CardsService);
    activityApi = inject(ActivityService);
    boardsApi = inject(BoardsService);
    authService = inject(AuthService);
    activities = signal<Activity[]>([]);

    readonly ChevronLeftIcon = ChevronLeftIcon;
    readonly ArchiveIcon = ArchiveIcon;
    readonly ActivityIcon = ActivityIcon;
    readonly UsersIcon = UsersIcon;
    readonly XIcon = XIcon;
    readonly PaletteIcon = PaletteIcon;
    readonly DownloadIcon = DownloadIcon;
    readonly UploadIcon = UploadIcon;
    readonly PencilIcon = PencilIcon;
    readonly CheckIcon = CheckIcon;
    readonly tMenu = $localize`:@@boardMenu.menu:Menu`;
    readonly tBackground = $localize`:@@boardMenu.background:Background`;
    readonly tVisibility = $localize`:@@boardMenu.visibility:Visibility`;
    readonly tActivity = $localize`:@@boardMenu.activity:Activity`;
    readonly tMembers = $localize`:@@boardMenu.members:Members`;
    readonly tArchivedItems = $localize`:@@boardMenu.archivedItems:Archived Items`;
    readonly tImportExport = $localize`:@@boardMenu.importExport:Import / Export`;
    readonly tRenameBoard = $localize`:@@boardMenu.renameBoard:Rename board`;
    readonly tEdit = $localize`:@@boardMenu.edit:Edit`;
    readonly tSave = $localize`:@@boardMenu.save:Save`;
    readonly tCancel = $localize`:@@boardMenu.cancel:Cancel`;
    readonly tChangeBackground = $localize`:@@boardMenu.changeBackground:Change background`;
    readonly tBoardVisibility = $localize`:@@boardMenu.boardVisibility:Board Visibility`;
    readonly tPrivate = $localize`:@@boardMenu.private:Private`;
    readonly tWorkspace = $localize`:@@boardMenu.workspace:Workspace`;
    readonly tPublic = $localize`:@@boardMenu.public:Public`;
    readonly tVisibilityPrivateHint = $localize`:@@boardMenu.visibilityPrivateHint:Only board members can see and edit this board`;
    readonly tVisibilityWorkspaceHint = $localize`:@@boardMenu.visibilityWorkspaceHint:All workspace members can see this board`;
    readonly tVisibilityPublicHint = $localize`:@@boardMenu.visibilityPublicHint:Anyone with the link can view this board`;
    readonly tColors = $localize`:@@boardMenu.colors:Colors`;
    readonly tPhotos = $localize`:@@boardMenu.photos:Photos`;
    readonly tArchivedCards = $localize`:@@boardMenu.archivedCards:Cards`;
    readonly tArchivedLists = $localize`:@@boardMenu.archivedLists:Lists`;
    readonly tListLabel = $localize`:@@boardMenu.listLabel:List:`;
    readonly tSendToBoard = $localize`:@@boardMenu.sendToBoard:Send to board`;
    readonly tNoArchivedCards = $localize`:@@boardMenu.noArchivedCards:No archived cards`;
    readonly tNoArchivedLists = $localize`:@@boardMenu.noArchivedLists:No archived lists`;
    readonly tActivityTitle = $localize`:@@boardMenu.activityTitle:Activity`;
    readonly tNoActivityFound = $localize`:@@boardMenu.noActivityFound:No activity found`;
    readonly tUserFallback = $localize`:@@boardMenu.userFallback:User`;
    readonly tUserInitial = $localize`:@@boardMenu.userInitial:U`;
    readonly tBoardMembers = $localize`:@@boardMenu.boardMembers:Board Members`;
    readonly tInviteToBoard = $localize`:@@boardMenu.inviteToBoard:Invite to board`;
    readonly tEmailOrName = $localize`:@@boardMenu.emailOrName:Email address or name`;
    readonly tRoleMember = $localize`:@@boardMenu.roleMember:Member`;
    readonly tRoleAdmin = $localize`:@@boardMenu.roleAdmin:Admin`;
    readonly tRoleViewer = $localize`:@@boardMenu.roleViewer:Viewer`;
    readonly tRoleOwner = $localize`:@@boardMenu.roleOwner:Owner`;
    readonly tInviting = $localize`:@@boardMenu.inviting:Inviting...`;
    readonly tInvite = $localize`:@@boardMenu.invite:Invite`;
    readonly tSearchMembers = $localize`:@@boardMenu.searchMembers:Search members...`;
    readonly tPending = $localize`:@@boardMenu.pending:Pending`;
    readonly tNoMembersFound = $localize`:@@boardMenu.noMembersFound:No members found`;
    readonly tExportBoard = $localize`:@@boardMenu.exportBoard:Export Board`;
    readonly tExportHint = $localize`:@@boardMenu.exportHint:Download the current board as a JSON file.`;
    readonly tExportJson = $localize`:@@boardMenu.exportJson:Export JSON`;
    readonly tExportPermissionHint = $localize`:@@boardMenu.exportPermissionHint:Only board owners or admins can export this board.`;
    readonly tImportBoard = $localize`:@@boardMenu.importBoard:Import Board`;
    readonly tImportHint = $localize`:@@boardMenu.importHint:Import a JSON board file into a workspace.`;
    readonly tWorkspaceLabel = $localize`:@@boardMenu.workspaceLabel:Workspace`;
    readonly tImporting = $localize`:@@boardMenu.importing:Importing...`;
    readonly tChooseJson = $localize`:@@boardMenu.chooseJson:Choose JSON file to import`;
    readonly tImportPermissionHint = $localize`:@@boardMenu.importPermissionHint:Only workspace admins or owners can import into this workspace.`;
    readonly tImportFailed = $localize`:@@boardMenu.importFailed:Failed to import board`;
    readonly tInviteFailed = $localize`:@@boardMenu.inviteFailed:Failed to invite user`;
    readonly tDeleteCardConfirm = $localize`:@@boardMenu.deleteCardConfirm:Delete this card forever?`;
    readonly tUnknownList = $localize`:@@boardMenu.unknownList:Unknown List`;
    readonly tCardsCount = (count: number) => $localize`:@@boardMenu.cardsCount:${count}:count: card(s)`;
    readonly tActivityCardFallback = $localize`:@@boardMenu.activity.cardFallback:a card`;
    readonly tActivityListFallback = $localize`:@@boardMenu.activity.listFallback:a list`;
    readonly tActivityAnotherListFallback = $localize`:@@boardMenu.activity.anotherListFallback:another list`;
    readonly tActivityLabelFallback = $localize`:@@boardMenu.activity.labelFallback:a label`;
    readonly tActivityMemberFallback = $localize`:@@boardMenu.activity.memberFallback:a member`;
    readonly tActivityPerformed = $localize`:@@boardMenu.activity.performed:performed an action`;
    readonly tBackgroundDefault = $localize`:@@boardMenu.backgroundDefault:Default`;
    readonly tBackgroundBlue = $localize`:@@boardMenu.backgroundBlue:Blue`;
    readonly tBackgroundGreen = $localize`:@@boardMenu.backgroundGreen:Green`;
    readonly tBackgroundPurple = $localize`:@@boardMenu.backgroundPurple:Purple`;
    readonly tBackgroundRed = $localize`:@@boardMenu.backgroundRed:Red`;
    readonly tBackgroundOrange = $localize`:@@boardMenu.backgroundOrange:Orange`;
    readonly tBackgroundPink = $localize`:@@boardMenu.backgroundPink:Pink`;
    readonly tBackgroundOcean = $localize`:@@boardMenu.backgroundOcean:Ocean`;
    readonly tBackgroundPurpleSky = $localize`:@@boardMenu.backgroundPurpleSky:Purple Sky`;
    readonly tBackgroundSunset = $localize`:@@boardMenu.backgroundSunset:Sunset`;
    readonly tBackgroundForest = $localize`:@@boardMenu.backgroundForest:Forest`;
    readonly tBackgroundDeepOcean = $localize`:@@boardMenu.backgroundDeepOcean:Deep Ocean`;

    workspacesApi = inject(WorkspacesService); // Inject WorkspacesService
    router = inject(Router);

    members = signal<BoardMemberLite[]>([]);
    inviteEmail = signal('');
    inviteRole = signal<MemberRole>('member');
    inviteError = signal('');
    isInviting = signal(false);

    // Workspace member search for invitation
    workspaceMembers = signal<WorkspaceMember[]>([]);
    showInviteDropdown = signal(false);
    importWorkspaceId = signal('');
    importError = signal('');
    importing = signal(false);
    renaming = signal(false);
    renameDraft = signal('');
    renameSaving = signal(false);

    // Check if current user can edit board (owner or admin)
    currentUserRole = computed(() => {
        const currentUserId = this.authService.user()?.id;
        if (!currentUserId) return null;

        // Use the separately loaded members list from the store
        const members = this.store.members();
        return members.find(m => m.userId === currentUserId || m.id === currentUserId)?.role || null;
    });

    myWorkspaces = signal<any[]>([]);

    constructor() {
        this.fetchMyWorkspaces();
    }

    async fetchMyWorkspaces() {
        try {
            const ws = await this.workspacesApi.list();
            this.myWorkspaces.set(ws);
        } catch (e) {
            console.error('Failed to load workspaces for permissions check', e);
        }
    }

    canEditBoard = computed(() => {
        const role = this.currentUserRole();
        if (role === 'owner' || role === 'admin') return true;

        // Fallback: Check if user is Workspace Admin/Owner
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        if (!board?.workspaceId) return false;

        const ws = this.myWorkspaces().find(w => w.id === board.workspaceId);
        return ws?.role === 'owner' || ws?.role === 'admin';
    });

    canRenameBoard = computed(() => {
        const role = this.currentUserRole();
        if (role === 'owner' || role === 'admin') return true;
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        if (!board?.workspaceId) return false;
        const ws = this.myWorkspaces().find(w => w.id === board.workspaceId);
        return ws?.role === 'owner' || ws?.role === 'admin';
    });

    canExportBoard = computed(() => {
        const role = this.currentUserRole();
        return role === 'owner' || role === 'admin';
    });

    canImportWorkspace = computed(() => {
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        if (!board?.workspaceId) return false;
        const ws = this.myWorkspaces().find(w => w.id === board.workspaceId);
        return ws?.role === 'owner' || ws?.role === 'admin';
    });

    // Computed signal to track current board's background for reactivity
    currentBoardBackground = computed(() => {
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        return board?.background || null;
    });

    canManageMember(member: BoardMemberLite): boolean {
        const myRole = this.currentUserRole();
        const myId = this.authService.user()?.id;

        // Cannot change own role
        if (member.userId === myId) return false;

        // Owner logic: Can manage anyone except other owners
        if (myRole === 'owner') {
            return member.role !== 'owner';
        }

        // Admin logic: Can manage members/viewers/admins, but cannot touch owners
        if (myRole === 'admin') {
            return member.role !== 'owner';
        }

        return false;
    }

    getAvailableRoles(): MemberRole[] {
        const myRole = this.currentUserRole();
        if (myRole === 'owner') {
            return ['owner', 'admin', 'member', 'viewer'];
        }
        if (myRole === 'admin') {
            // Admin cannot promote to owner
            return ['admin', 'member', 'viewer'];
        }
        return [];
    }

    roleLabel(role: MemberRole) {
        switch (role) {
            case 'admin': return this.tRoleAdmin;
            case 'viewer': return this.tRoleViewer;
            case 'member': return this.tRoleMember;
            case 'owner': return this.tRoleOwner;
            default: return role;
        }
    }

    isOpen = signal(false);
    view = signal<'main' | 'background' | 'visibility' | 'archived' | 'activity' | 'members' | 'importExport'>('main');
    archivedView = signal<'cards' | 'lists'>('cards'); // Tab selection for archived view
    viewTitle = computed(() => {
        switch (this.view()) {
            case 'background': return this.tBackground;
            case 'visibility': return this.tVisibility;
            case 'activity': return this.tActivity;
            case 'members': return this.tMembers;
            case 'archived': return this.tArchivedItems;
            case 'importExport': return this.tImportExport;
            default: return this.tMenu;
        }
    });

    archivedCards = signal<Card[]>([]);
    archivedLists = signal<ListDto[]>([]);

    async selectVisibility(visibility: 'private' | 'workspace' | 'public') {
        const boardId = this.store.currentBoardId();
        if (!boardId) return;

        try {
            // Update via PATCH /api/boards/:id
            await this.boardsApi.updateBoard(boardId, { visibility });

            // Update local store
            const boards = this.store.boards();
            const updated = boards.map(b => b.id === boardId ? { ...b, visibility } : b);
            this.store.setBoards(updated);
        } catch (err) {
            console.error('Failed to update visibility:', err);
        }
    }

    getCurrentVisibility(): 'private' | 'workspace' | 'public' {
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        return board?.visibility || 'private';
    }

    // Background options
    backgrounds = [
        { id: 'none', name: this.tBackgroundDefault, class: 'bg-slate-50' },
        { id: 'blue', name: this.tBackgroundBlue, class: 'bg-blue-500' },
        { id: 'green', name: this.tBackgroundGreen, class: 'bg-green-500' },
        { id: 'purple', name: this.tBackgroundPurple, class: 'bg-purple-500' },
        { id: 'red', name: this.tBackgroundRed, class: 'bg-red-500' },
        { id: 'orange', name: this.tBackgroundOrange, class: 'bg-orange-500' },
        { id: 'pink', name: this.tBackgroundPink, class: 'bg-pink-500' },
        { id: 'gradient-blue', name: this.tBackgroundOcean, class: 'bg-gradient-to-br from-blue-400 to-cyan-500' },
        { id: 'gradient-purple', name: this.tBackgroundPurpleSky, class: 'bg-gradient-to-br from-purple-400 to-pink-500' },
        { id: 'gradient-sunset', name: this.tBackgroundSunset, class: 'bg-gradient-to-br from-orange-400 to-red-500' },
        { id: 'gradient-forest', name: this.tBackgroundForest, class: 'bg-gradient-to-br from-green-400 to-emerald-600' },
        { id: 'gradient-ocean', name: this.tBackgroundDeepOcean, class: 'bg-gradient-to-br from-cyan-500 to-blue-700' },
    ];

    images = [
        'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1000&q=80'
    ];

    open() {
        this.isOpen.set(true);
        this.view.set('main');
        this.syncImportWorkspace();
        this.syncRenameDraft();
    }

    close() {
        this.isOpen.set(false);
    }

    syncRenameDraft() {
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        this.renameDraft.set(board?.name ?? '');
        this.renaming.set(false);
    }

    startRenameBoard() {
        if (!this.canRenameBoard()) return;
        this.syncRenameDraft();
        this.renaming.set(true);
    }

    cancelRenameBoard() {
        this.syncRenameDraft();
    }

    async saveRenameBoard() {
        if (this.renameSaving()) return;
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        if (!board) return;
        const next = this.renameDraft().trim();
        if (!next || next === board.name) {
            this.renaming.set(false);
            return;
        }
        this.renameSaving.set(true);
        try {
            await this.boardsApi.updateBoard(board.id, { name: next });
        } catch (err) {
            console.error('Failed to rename board', err);
        } finally {
            this.renameSaving.set(false);
            this.renaming.set(false);
        }
    }

    onRenameKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.saveRenameBoard();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelRenameBoard();
        }
    }

    openImportExport() {
        if (!this.canExportBoard() && !this.canImportWorkspace()) return;
        this.view.set('importExport');
        this.syncImportWorkspace();
    }

    syncImportWorkspace() {
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        if (board?.workspaceId) {
            this.importWorkspaceId.set(board.workspaceId);
        } else if (this.myWorkspaces().length) {
            this.importWorkspaceId.set(this.myWorkspaces()[0].id);
        }
    }

    selectImportWorkspace(event: Event) {
        const target = event.target as HTMLSelectElement;
        this.importWorkspaceId.set(target.value);
    }

    async exportBoard() {
        const boardId = this.store.currentBoardId();
        if (!boardId || !this.canExportBoard()) return;
        try {
            const data = await this.boardsApi.exportBoard(boardId);
            const board = this.store.boards().find(b => b.id === boardId);
            const fileNameBase = (board?.name || 'board').replace(/[^a-zA-Z0-9_-]+/g, '-');
            const stamp = new Date().toISOString().slice(0, 10);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileNameBase}-${stamp}.json`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export board', err);
        }
    }

    async importBoardFromFile(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file || !this.canImportWorkspace()) return;
        this.importError.set('');
        this.importing.set(true);
        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            const workspaceId = this.importWorkspaceId();
            if (!workspaceId) throw new Error('Choose a workspace for import');
            const board = await this.boardsApi.importBoard(workspaceId, payload);
            this.close();
            this.router.navigate(['/b', board.id]);
        } catch (err: any) {
            this.importError.set(err?.message || this.tImportFailed);
        } finally {
            this.importing.set(false);
            input.value = '';
        }
    }

    async showArchived() {
        this.view.set('archived');
        this.archivedView.set('cards');
        await this.loadArchivedCards();
    }

    async loadArchivedCards() {
        const allLists = this.store.lists();
        // Filter cards that are archived
        const cards = allLists.flatMap(l => l.cards || []).filter(c => c.isArchived);
        this.archivedCards.set(cards);
    }

    async loadArchivedLists() {
        const allLists = this.store.lists();
        // Filter lists that are archived
        const lists = allLists.filter(l => l.isArchived);
        this.archivedLists.set(lists);
    }

    async switchToArchivedCards() {
        this.archivedView.set('cards');
        await this.loadArchivedCards();
    }

    async switchToArchivedLists() {
        this.archivedView.set('lists');
        await this.loadArchivedLists();
    }

    async showArchivedCards() {
        this.view.set('archived');
        this.archivedView.set('cards');
        await this.loadArchivedCards();
    }

    async showArchivedLists() {
        this.view.set('archived');
        this.archivedView.set('lists');
        await this.loadArchivedLists();
    }

    async restoreCard(card: Card) {
        await this.cardsApi.patchCardExtended(card.id, { isArchived: false });
        // Update store: set isArchived=false
        this.store.upsertCardLocally(card.listId, { ...card, isArchived: false });
        // Remove from archived view
        // The computed `archivedCards` will automatically update.
        // No need for `this.archivedCards.update(...)` if it's a computed signal.
    }

    async restore(cardId: string) { // New method, potentially replaces restoreCard or is an alternative
        await this.cardsApi.patchCardExtended(cardId, { title: "", isArchived: false });
        // The store update logic for this new method is not provided in the instruction.
        // Assuming the store is updated by the service or will be handled elsewhere.
    }

    async deleteCard(card: Card) {
        if (!confirm(this.tDeleteCardConfirm)) return;
        await this.cardsApi.deleteCard(card.id);
        // Store automatically removes it via deleteCard service call usually, but let's be sure
        // actually cardsApi.deleteCard calls store.removeCardLocally
        // The computed `archivedCards` will automatically update.
    }

    async restoreList(list: ListDto) {
        await this.listsApi.updateList(list.id, { isArchived: false });
        // Update store: set isArchived=false
        const current = this.store.lists();
        this.store.setLists(current.map(l => l.id === list.id ? { ...l, isArchived: false } : l));
        // Remove from archived view
        this.archivedLists.update(lists => lists.filter(l => l.id !== list.id));
    }

    // --- Activity ---
    async selectBackground(background: string) {
        const boardId = this.store.currentBoardId();
        if (!boardId) return;

        try {
            await this.boardsApi.updateBoardBackground(boardId, background);
            // The store is already updated by the service
        } catch (err) {
            console.error('Failed to update background:', err);
        }
    }

    isBackgroundSelected(backgroundId: string): boolean {
        return this.currentBoardBackground() === backgroundId;
    }

    async showActivity() {
        this.view.set('activity');
        const boardId = this.store.currentBoardId();
        if (boardId) { // Changed from `if (!boardId) return;` to `if (boardId)`
            const acts = await this.activityApi.getBoardActivity(boardId);
            this.activities.set(acts);
        }
    }

    formatActivity(act: Activity): string {
        const payload = act.payload || {};
        const cardTitle = act.card?.title || this.tActivityCardFallback;

        switch (act.type) {
            case 'create_card':
                const listName = payload.listName || this.tActivityListFallback;
                return $localize`:@@boardMenu.activity.createCard:created card "${cardTitle}:cardTitle:" in ${listName}:listName:`;
            case 'move_card':
                const fromList = payload.fromList || this.tActivityListFallback;
                const toList = payload.toList || this.tActivityAnotherListFallback;
                return $localize`:@@boardMenu.activity.moveCard:moved "${cardTitle}:cardTitle:" from ${fromList}:fromList: to ${toList}:toList:`;
            case 'archive_card':
                return $localize`:@@boardMenu.activity.archiveCard:archived "${cardTitle}:cardTitle:"`;
            case 'restore_card':
                return $localize`:@@boardMenu.activity.restoreCard:restored "${cardTitle}:cardTitle:"`;
            case 'delete_card':
                return $localize`:@@boardMenu.activity.deleteCard:deleted "${cardTitle}:cardTitle:"`;
            case 'comment_card':
                return $localize`:@@boardMenu.activity.commentCard:commented on "${cardTitle}:cardTitle:"`;
            case 'update_card':
                if (payload.field === 'title') {
                    return $localize`:@@boardMenu.activity.renameCard:renamed card to "${cardTitle}:cardTitle:"`;
                } else if (payload.field === 'description') {
                    return $localize`:@@boardMenu.activity.updateDescription:updated description on "${cardTitle}:cardTitle:"`;
                }
                return $localize`:@@boardMenu.activity.updateCard:updated "${cardTitle}:cardTitle:"`;
            case 'add_label':
                const labelName = payload.labelName || this.tActivityLabelFallback;
                return $localize`:@@boardMenu.activity.addLabel:added label "${labelName}:labelName:" to "${cardTitle}:cardTitle:"`;
            case 'remove_label':
                const removedLabel = payload.labelName || this.tActivityLabelFallback;
                return $localize`:@@boardMenu.activity.removeLabel:removed label "${removedLabel}:labelName:" from "${cardTitle}:cardTitle:"`;
            case 'add_member':
                const memberName = payload.memberName || this.tActivityMemberFallback;
                return $localize`:@@boardMenu.activity.addMember:added ${memberName}:memberName: to "${cardTitle}:cardTitle:"`;
            case 'remove_member':
                const removedMember = payload.memberName || this.tActivityMemberFallback;
                return $localize`:@@boardMenu.activity.removeMember:removed ${removedMember}:memberName: from "${cardTitle}:cardTitle:"`;
            default:
                return this.tActivityPerformed;
        }
    }

    async onInviteSearch(e: Event) {
        const val = (e.target as HTMLInputElement).value;
        this.inviteEmail.set(val);
        this.inviteError.set('');

        if (val.trim().length < 1) {
            this.workspaceMembers.set([]);
            this.showInviteDropdown.set(false);
            return;
        }

        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        if (!board?.workspaceId) return;

        try {
            const members = await this.workspacesApi.searchMembers(board.workspaceId, val);
            // Filter out members already on the board
            const currentMemberIds = new Set(this.members().map(m => m.id));
            const available = members.filter(m => !currentMemberIds.has(m.id));
            this.workspaceMembers.set(available);
            this.showInviteDropdown.set(available.length > 0);
        } catch (err) {
            console.error('Failed to search workspace members', err);
        }
    }

    selectInviteMember(member: WorkspaceMember) {
        this.inviteEmail.set(member.email || ''); // Use email if available, or we might need to change addMember to accept userId
        // Actually boardsApi.addMember takes email. If the workspace member doesn't have email visible, this might be tricky.
        // But the search endpoint returns email.
        this.showInviteDropdown.set(false);
        // Optionally auto-invite? Or just fill the input? Let's fill the input.
    }

    async inviteMember() {
        const email = this.inviteEmail().trim();
        if (!email) return;

        const boardId = this.store.currentBoardId();
        if (!boardId) return;

        this.isInviting.set(true);
        this.inviteError.set('');

        try {
            await this.boardsApi.addMember(boardId, email, this.inviteRole());
            this.inviteEmail.set('');
            this.showInviteDropdown.set(false);
            await this.fetchMembers();
        } catch (err: any) {
            this.inviteError.set(err?.error?.error || this.tInviteFailed);
        } finally {
            this.isInviting.set(false);
        }
    }

    // --- Members ---
    async showMembers() {
        this.view.set('members');
        this.fetchMembers();
    }

    async fetchMembers(query?: string) {
        const boardId = this.store.currentBoardId();
        if (boardId) {
            const mems = await this.boardsApi.searchMembers(boardId, query);
            this.members.set(mems ? mems : []);
        }
    }

    onMemberSearch(e: Event) {
        const val = (e.target as HTMLInputElement).value;
        this.fetchMembers(val);
    }

    getMemberHandle(m: BoardMemberLite): string {
        return '@' + (m.name || '').toLowerCase().replace(/\s+/g, '');
    }

    async updateRole(userId: string, role: MemberRole) {
        const boardId = this.store.currentBoardId();
        if (boardId) {
            await this.boardsApi.updateBoardMemberRole(boardId, userId, role);
            // refresh
            await this.fetchMembers();
        }
    }

    getListName(listId: string): string {
        const list = this.store.lists().find(l => l.id === listId);
        return list?.name || this.tUnknownList;
    }
}
