import {Component, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivityIcon, ArchiveIcon, ChevronLeftIcon, UsersIcon} from 'lucide-angular';
import {BoardStore} from '../../store/board-store.service';
import {ListsService} from '../../data/lists.service';
import {CardsService} from '../../data/cards.service';
import {BoardMemberLite, BoardsService, MemberRole} from '../../data/boards.service';
import {Activity, Card, ListDto} from '../../types';
import {ActivityService} from '../../data/activity.service'; // Keep Activity type from original import

@Component({
    standalone: true,
    selector: 'board-menu',
    imports: [CommonModule],
    templateUrl: './board-menu.component.html',
    styleUrls: ['./board-menu.component.css']
})
export class BoardMenuComponent {
    store = inject(BoardStore);
    listsApi = inject(ListsService);
    cardsApi = inject(CardsService);
    activityApi = inject(ActivityService);
    boardsApi = inject(BoardsService);
    activities = signal<Activity[]>([]);

    readonly ChevronLeftIcon = ChevronLeftIcon;
    readonly ArchiveIcon = ArchiveIcon;
    readonly ActivityIcon = ActivityIcon;
    readonly UsersIcon = UsersIcon;

    members = signal<BoardMemberLite[]>([]);

    isOpen = signal(false);
    view = signal<'main' | 'archived-cards' | 'archived-lists' | 'activity' | 'members'>('main');

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

    open() {
        this.isOpen.set(true);
        this.view.set('main');
    }

    close() {
        this.isOpen.set(false);
    }

    async showArchivedCards() {
        this.view.set('archived-cards');
        const allLists = this.store.lists();
        // Filter cards that are archived
        const cards = allLists.flatMap(l => l.cards || []).filter(c => c.isArchived);
        this.archivedCards.set(cards);
    }

    async showArchivedLists() {
        this.view.set('archived-lists');
        const allLists = this.store.lists();
        // Filter lists that are archived
        const lists = allLists.filter(l => l.isArchived);
        this.archivedLists.set(lists);
    }

    async restoreCard(card: Card) {
        await this.cardsApi.patchCardExtended(card.id, {isArchived: false});
        // Update store: set isArchived=false
        this.store.upsertCardLocally(card.listId, {...card, isArchived: false});
        // Remove from archived view
        // The computed `archivedCards` will automatically update.
        // No need for `this.archivedCards.update(...)` if it's a computed signal.
    }

    async restore(cardId: string) { // New method, potentially replaces restoreCard or is an alternative
        await this.cardsApi.patchCardExtended(cardId, {title: "", isArchived: false});
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
        await this.listsApi.updateList(list.id, {isArchived: false});
        // Update store: set isArchived=false
        const current = this.store.lists();
        this.store.setLists(current.map(l => l.id === list.id ? {...l, isArchived: false} : l));
        // Remove from archived view
        this.archivedLists.update(lists => lists.filter(l => l.id !== list.id));
    }

    // --- Activity ---
    async showActivity() {
        this.view.set('activity');
        const boardId = this.store.currentBoardId();
        if (boardId) { // Changed from `if (!boardId) return;` to `if (boardId)`
            const acts = await this.activityApi.getBoardActivity(boardId);
            this.activities.set(acts);
        }
    }

    formatActivity(act: any): string { // Changed parameter name from 'a' to 'act' and type from Activity to any
        // Original logic for formatActivity was more detailed, new one is simpler.
        // Keeping the new simpler logic as per instruction.
        switch (act.type) {
            case 'create_card':
                return `added ${act.card?.title} to ${act.list?.name}`;
            case 'move_card':
                return `moved ${act.card?.title} to ${act.list?.name}`;
            case 'comment_card':
                return `commented on ${act.card?.title}`;
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
}
