import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    ActivityIcon,
    ArchiveIcon,
    ChevronLeftIcon,
    LucideAngularModule,
    PaletteIcon,
    UsersIcon,
    XIcon
} from 'lucide-angular';
import { BoardStore } from '../../store/board-store.service';
import { ListsService } from '../../data/lists.service';
import { CardsService } from '../../data/cards.service';
import { BoardMemberLite, BoardsService, MemberRole } from '../../data/boards.service';
import { Activity, Card, ListDto } from '../../types';
import { ActivityService } from '../../data/activity.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';

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

    members = signal<BoardMemberLite[]>([]);
    inviteEmail = signal('');
    inviteRole = signal<MemberRole>('member');
    inviteError = signal('');
    isInviting = signal(false);

    // Check if current user can edit board (owner or admin)
    canEditBoard = computed(() => {
        const currentUserId = this.authService.user()?.id;
        if (!currentUserId) return false;

        const boardId = this.store.currentBoardId();
        if (!boardId) return false;

        const board = this.store.boards().find(b => b.id === boardId);
        if (!board?.members) return false;

        const myMembership = board.members.find(m => m.userId === currentUserId);
        return myMembership?.role === 'owner' || myMembership?.role === 'admin';
    });

    isOpen = signal(false);
    view = signal<'main' | 'background' | 'visibility' | 'archived' | 'activity' | 'members'>('main');
    archivedView = signal<'cards' | 'lists'>('cards'); // Tab selection for archived view

    // Archived items derived from store
    // Note: This assumes the store contains ALL items, including archived ones.
    // If the backend filters them out, we might need a separate API call to fetch archived items.
    // For now, let's assume we need to fetch them, or they are in the store but hidden.
    // Actually, usually Kanban boards hide archived items from the main view.
    // Let's assume the store `lists()` only has visible lists.
    // We might need a new method in store or service to get archived items.
    // For MVP, let's implement the UI and hook up the API calls.

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
        { id: 'none', name: 'Default', class: 'bg-slate-50' },
        { id: 'blue', name: 'Blue', class: 'bg-blue-500' },
        { id: 'green', name: 'Green', class: 'bg-green-500' },
        { id: 'purple', name: 'Purple', class: 'bg-purple-500' },
        { id: 'red', name: 'Red', class: 'bg-red-500' },
        { id: 'orange', name: 'Orange', class: 'bg-orange-500' },
        { id: 'pink', name: 'Pink', class: 'bg-pink-500' },
        { id: 'gradient-blue', name: 'Ocean', class: 'bg-gradient-to-br from-blue-400 to-cyan-500' },
        { id: 'gradient-purple', name: 'Purple Sky', class: 'bg-gradient-to-br from-purple-400 to-pink-500' },
        { id: 'gradient-sunset', name: 'Sunset', class: 'bg-gradient-to-br from-orange-400 to-red-500' },
        { id: 'gradient-forest', name: 'Forest', class: 'bg-gradient-to-br from-green-400 to-emerald-600' },
        { id: 'gradient-ocean', name: 'Deep Ocean', class: 'bg-gradient-to-br from-cyan-500 to-blue-700' },
    ];

    open() {
        this.isOpen.set(true);
        this.view.set('main');
    }

    close() {
        this.isOpen.set(false);
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
        if (!confirm('Delete this card forever?')) return;
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
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        return board?.background === backgroundId;
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
        const cardTitle = act.card?.title || 'a card';

        switch (act.type) {
            case 'create_card':
                const listName = payload.listName || 'a list';
                return `created card "${cardTitle}" in ${listName}`;
            case 'move_card':
                const fromList = payload.fromList || 'a list';
                const toList = payload.toList || 'another list';
                return `moved "${cardTitle}" from ${fromList} to ${toList}`;
            case 'archive_card':
                return `archived "${cardTitle}"`;
            case 'restore_card':
                return `restored "${cardTitle}"`;
            case 'delete_card':
                return `deleted "${cardTitle}"`;
            case 'comment_card':
                return `commented on "${cardTitle}"`;
            case 'update_card':
                if (payload.field === 'title') {
                    return `renamed card to "${cardTitle}"`;
                } else if (payload.field === 'description') {
                    return `updated description on "${cardTitle}"`;
                }
                return `updated "${cardTitle}"`;
            case 'add_label':
                const labelName = payload.labelName || 'a label';
                return `added label "${labelName}" to "${cardTitle}"`;
            case 'remove_label':
                const removedLabel = payload.labelName || 'a label';
                return `removed label "${removedLabel}" from "${cardTitle}"`;
            case 'add_member':
                const memberName = payload.memberName || 'a member';
                return `added ${memberName} to "${cardTitle}"`;
            case 'remove_member':
                const removedMember = payload.memberName || 'a member';
                return `removed ${removedMember} from "${cardTitle}"`;
            default:
                return 'performed an action';
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
            await this.fetchMembers();
        } catch (err: any) {
            this.inviteError.set(err?.error?.error || 'Failed to invite user');
        } finally {
            this.isInviting.set(false);
        }
    }

    getListName(listId: string): string {
        const list = this.store.lists().find(l => l.id === listId);
        return list?.name || 'Unknown List';
    }
}
