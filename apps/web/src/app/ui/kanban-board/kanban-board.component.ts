import { Component, computed, effect, inject, OnInit, OnDestroy } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    CdkDrag,
    CdkDragDrop, CdkDragPlaceholder, CdkDragPreview,
    CdkDropList,
    CdkDropListGroup,
    moveItemInArray,
    transferArrayItem,
} from '@angular/cdk/drag-drop';
import type { Card, ListDto } from '../../types';
import { BoardStore } from '../../store/board-store.service';
import { BoardsService } from '../../data/boards.service';
import { ListsService } from '../../data/lists.service';
import { CardsService } from '../../data/cards.service';
import { SocketService } from '../../data/socket.service';
import { ListColumnComponent } from "../list-column/list-column.component";
import { CardModalService } from "../card-modal/card-modal.service";
import { ActivatedRoute, Router } from "@angular/router";
import { BoardMenuComponent } from "../board-menu/board-menu.component";
import { CardModalComponent } from "../card-modal/card-modal.component";

@Component({
    selector: 'kanban-board',
    standalone: true,
    imports: [NgFor, NgIf, FormsModule, CdkDropListGroup, ListColumnComponent, CardModalComponent, CdkDropList, CdkDrag, CdkDragPreview, CdkDragPlaceholder, BoardMenuComponent, NgClass], // ⬅️ include group
    templateUrl: './kanban-board.component.html',
    styleUrls: ['./kanban-board.component.css'],
})
export class KanbanBoardComponent implements OnInit {
    // store + services
    store = inject(BoardStore);
    boardsApi = inject(BoardsService);
    listsApi = inject(ListsService);
    cardsApi = inject(CardsService);
    socket = inject(SocketService);
    modal = inject(CardModalService);
    route = inject(ActivatedRoute);
    router = inject(Router);

    // popovers per card
    showLabels: Record<string, boolean> = {};

    // ui state
    newListTitle = '';
    newCard: Record<string, string> = {};
    titles: Record<string, string> = {};
    showNewCard: Record<string, boolean> = {};

    // filters & inline edit
    filter = '';
    activeLabel = ''; // used by header label filter
    activeMemberId = ''; // used by header member filter
    editingCard: Record<string, boolean> = {};
    cardTitles: Record<string, string> = {};
    trackList = (_: number, l: ListDto) => l.id;

    constructor() {
        this.boardsApi.loadBoards();

        // Deep-link: open when ?card=ID is present
        this.route.queryParamMap.subscribe(q => {
            const id = q.get('card');
            if (id) this.modal.open(id);
        });

        effect(() => {
            const lists = this.store.lists();
            for (const l of lists) {
                this.titles[l.id] = l.title ?? l.name ?? '';
                if (!(l.id in this.showNewCard)) this.showNewCard[l.id] = false;
                for (const c of l.cards ?? []) {
                    if (!(c.id in this.cardTitles)) this.cardTitles[c.id] = c.title ?? '';
                }
            }

            const isOpen = this.modal.isOpen();
            const id = this.modal.cardId();
            // const qp = isOpen && id ? { card: id } : {}; // Original line
            this.router.navigate([], { queryParams: { card: id || undefined }, queryParamsHandling: 'merge' });
        });

        // Real-time board updates
        effect(() => {
            const boardId = this.store.currentBoardId();
            if (boardId) {
                this.socket.subscribeToBoard(boardId);
            }
        });

        // Listen for new cards
        this.socket.on('card:created', (card: Card) => {
            const currentBoardId = this.store.currentBoardId();
            // Ensure the card belongs to the current board (via list)
            // We can't easily check boardId on card without list relation, but we trust the room.
            // However, we need the listId to upsert.
            if (card.listId) {
                this.store.upsertCardLocally(card.listId, card);
            }
        });

        // Listen for card moves
        this.socket.on('card:moved', (data: { cardId: string; toListId: string; rank: string; listId: string }) => {
            // 1. Remove from source list (data.listId)
            // 2. Add to target list (data.toListId) with new rank
            // We can use store.upsertCardLocally if we have the full card, but we only have partial data.
            // However, we can find the card in the store first.

            const allLists = this.store.lists();
            let card: Card | undefined;

            // Find the card in current lists
            for (const l of allLists) {
                const found = l.cards?.find(c => c.id === data.cardId);
                if (found) {
                    card = found;
                    break;
                }
            }

            if (card) {
                // Update card data
                const updatedCard = { ...card, listId: data.toListId, rank: data.rank };

                // Remove from old list (if different)
                // Actually, upsertCardLocally might not handle moving between lists if it just updates by ID.
                // Let's check BoardStore implementation.
                // It maps over lists and checks if listId matches.
                // If we want to move it, we might need to remove it first if the list changed.

                if (data.listId !== data.toListId) {
                    // Remove from source
                    const sourceList = allLists.find(l => l.id === data.listId);
                    if (sourceList) {
                        const nextSourceCards = (sourceList.cards || []).filter(c => c.id !== data.cardId);
                        // We need a way to update the list in the store. 
                        // store.setLists is available.

                        // Let's do it manually for now as store helpers are limited
                        const nextLists = allLists.map(l => {
                            if (l.id === data.listId) return { ...l, cards: nextSourceCards };
                            if (l.id === data.toListId) {
                                const targetCards = [...(l.cards || [])];
                                // Insert at correct position based on rank would be ideal, but appending is safer for now 
                                // or we can try to sort.
                                // For now, let's just push it and let the user refresh if they care about exact rank, 
                                // or better: try to insert it.
                                targetCards.push(updatedCard);
                                // Sort by rank
                                targetCards.sort((a, b) => (a.rank || '').localeCompare(b.rank || ''));
                                return { ...l, cards: targetCards };
                            }
                            return l;
                        });
                        this.store.setLists(nextLists);
                    }
                } else {
                    // Same list reorder
                    // Just update the rank and resort
                    const nextLists = allLists.map(l => {
                        if (l.id === data.toListId) {
                            const targetCards = (l.cards || []).map(c => c.id === data.cardId ? updatedCard : c);
                            targetCards.sort((a, b) => (a.rank || '').localeCompare(b.rank || ''));
                            return { ...l, cards: targetCards };
                        }
                        return l;
                    });
                    this.store.setLists(nextLists);
                }
            }
        });

        // Listen for board updates (background)
        this.socket.on('board:updated', (board: any) => {
            const current = this.store.boards();
            const updated = current.map(b => b.id === board.id ? { ...b, ...board } : b);
            this.store.setBoards(updated);
        });
    }

    // Map board background to CSS classes
    boardBackground = computed(() => {
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        const bg = board?.background;

        const bgMap: Record<string, string> = {
            'none': 'bg-slate-50',
            'blue': 'bg-blue-500',
            'green': 'bg-green-500',
            'purple': 'bg-purple-500',
            'red': 'bg-red-500',
            'orange': 'bg-orange-500',
            'pink': 'bg-pink-500',
            'gradient-blue': 'bg-gradient-to-br from-blue-400 to-cyan-500',
            'gradient-purple': 'bg-gradient-to-br from-purple-400 to-pink-500',
            'gradient-sunset': 'bg-gradient-to-br from-orange-400 to-red-500',
            'gradient-forest': 'bg-gradient-to-br from-green-400 to-emerald-600',
            'gradient-ocean': 'bg-gradient-to-br from-cyan-500 to-blue-700',
        };

        return bg && bgMap[bg] ? bgMap[bg] : 'bg-slate-50';
    });
    // whenever modal opens/closes, sync query param
    ngOnInit() {
    }

    // projections
    boards = () => this.store.boards();
    currentBoardId = () => this.store.currentBoardId();
    // Only show active lists on the board
    lists = () => this.store.lists().filter(l => !l.isArchived);

    // header label filter handler (called from template)
    updateActiveLabel(val: string) {
        this.activeLabel = val || '';
    }

    updateActiveMember(val: string) {
        this.activeMemberId = val || '';
    }

    // label menu toggles (called from template)
    toggleLabelsMenu(cardId: string) {
        // close all others so only one popover is open at a time
        this.closeAllLabelMenus();
        this.showLabels[cardId] = !this.showLabels[cardId];
    }

    closeLabels(cardId: string) {
        if (this.showLabels[cardId]) this.showLabels[cardId] = false;
    }

    closeAllLabelMenus() {
        for (const k of Object.keys(this.showLabels)) this.showLabels[k] = false;
    }

    // filtering logic
    cards = (listId: string) => {
        const list = this.store.lists().find((x) => x.id === listId);
        let cards = (list?.cards ?? []) as Card[];

        const q = this.filter.trim().toLowerCase();
        if (q) cards = cards.filter((c) => (c.title ?? '').toLowerCase().includes(q));

        if (this.activeLabel) {
            const ids = (c: any) => {
                if (Array.isArray(c.labelIds)) return c.labelIds;
                if (Array.isArray(c.labels)) return c.labels.map((x: any) => (typeof x === 'string' ? x : x?.id ?? x?.labelId)).filter(Boolean);
                if (Array.isArray(c.cardLabels)) return c.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
                return [];
            };
            cards = cards.filter((c) => ids(c).includes(this.activeLabel));
        }

        if (this.activeMemberId) {
            const memberIds = (c: any) => {
                if (Array.isArray(c.assignees)) return c.assignees.map((x: any) => x?.userId ?? x?.id).filter(Boolean);
                return [];
            };
            cards = cards.filter((c) => memberIds(c).includes(this.activeMemberId));
        }

        return cards;
    };

    trackCard = (_: number, c: Card) => c.id;

    onSelectBoard(boardId: string) {
        this.boardsApi.selectBoard(boardId);
    }

    async refresh() {
        const id = this.store.currentBoardId();
        if (id) await this.boardsApi.selectBoard(id);
    }

    async addList() {
        const name = this.newListTitle?.trim();
        if (!name) return;
        await this.listsApi.createList(name);
        this.newListTitle = '';
    }

    async renameList(l: ListDto) {
        const next = (this.titles[l.id] ?? '').trim();
        const curr = l.title ?? l.name ?? '';
        if (!next || next === curr) return;
        await this.listsApi.updateListName(l.id, next);
        await this.refresh();
    }

    onListTitleKeydown(ev: KeyboardEvent, l: ListDto) {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            this.renameList(l);
            (ev.target as HTMLInputElement).blur();
        } else if (ev.key === 'Escape') {
            this.titles[l.id] = l.title ?? l.name ?? '';
            (ev.target as HTMLInputElement).blur();
        }
    }

    toggleAddCard(listId: string) {
        this.showNewCard[listId] = !this.showNewCard[listId];
        if (this.showNewCard[listId] && !this.newCard[listId]) this.newCard[listId] = '';
    }

    async addCard(listId: string) {
        const title = (this.newCard[listId] ?? '').trim();
        if (!title) return;
        await this.cardsApi.createCard(listId, title);
        this.newCard[listId] = '';
        this.showNewCard[listId] = false;
        await this.refresh();
    }

    onCardKeydown(ev: KeyboardEvent, listId: string) {
        if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
            this.addCard(listId);
        } else if (ev.key === 'Escape') {
            this.showNewCard[listId] = false;
            (ev.target as HTMLTextAreaElement).blur();
        }
    }

    async onListDropped(event: CdkDragDrop<ListDto[]>) {
        const lists = [...this.store.lists()];
        if (event.previousIndex === event.currentIndex) return;

        moveItemInArray(lists, event.previousIndex, event.currentIndex);
        // optimistic local update
        this.store.setLists?.(lists);

        try {
            const orderedIds = lists.map(l => l.id);
            await this.listsApi.reorderLists(orderedIds);
        } catch {
            // optional: reload on failure
            await this.refresh();
        }
    }

    // inline card edit
    startEditCard(card: Card) {
        this.editingCard[card.id] = true;
        this.cardTitles[card.id] = card.title ?? '';
    }

    cancelEditCard(cardId: string) {
        this.editingCard[cardId] = false;
    }

    async saveEditCard(card: Card) {
        const next = (this.cardTitles[card.id] ?? '').trim();
        if (!next || next === card.title) {
            this.editingCard[card.id] = false;
            return;
        }
        await this.cardsApi.updateCard(card.id, { title: next });
        // optimistic local patch if available
        this.store.patchCardTitleLocally?.(card.id, next);
        this.editingCard[card.id] = false;
    }

    onEditCardKeydown(ev: KeyboardEvent, card: Card) {
        if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
            ev.preventDefault();
            this.saveEditCard(card);
        } else if (ev.key === 'Escape') {
            this.cancelEditCard(card.id);
            (ev.target as HTMLInputElement).blur();
        }
    }

    // DnD (keep cdkDropListData bound to full list array; render filtered list separately)
    async onCardDropped(event: CdkDragDrop<Card[]>, toListId: string) {
        if (event.previousContainer === event.container) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        } else {
            transferArrayItem(
                event.previousContainer.data,
                event.container.data,
                event.previousIndex,
                event.currentIndex
            );
        }
        const id = event.container.data[event.currentIndex].id;
        const before = event.container.data[event.currentIndex - 1]?.id ?? null;
        const after = event.container.data[event.currentIndex + 1]?.id ?? null;
        await this.cardsApi.moveCard(id, toListId, before, after);
    }

    // label helpers (board-level, used in template)
    labelIds(c: any): string[] {
        if (Array.isArray(c?.labelIds)) return c.labelIds as string[];
        if (Array.isArray(c?.labels)) {
            const first = c.labels[0];
            if (typeof first === 'string') return c.labels as string[];
            return (c.labels as any[]).map(x => x?.id ?? x?.labelId).filter(Boolean);
        }
        if (Array.isArray(c?.cardLabels)) return (c.cardLabels as any[]).map(x => x?.labelId).filter(Boolean);
        return [];
    }

    colorOf = (labelId: string) => this.store.labels().find(lb => lb.id === labelId)?.color ?? '#ccc';

    hasLabel = (c: Card, lid: string) => this.labelIds(c).includes(lid);

    async toggleLabel(c: Card, lid: string) {
        if (this.hasLabel(c, lid)) {
            await this.cardsApi.removeLabel(c.id, lid);
            (this.store.removeLabelFromCardLocally ?? this.store.removeLabelFromCard)?.(c.id, lid);
        } else {
            await this.cardsApi.addLabel(c.id, lid);
            (this.store.addLabelToCardLocally ?? this.store.addLabelToCard)?.(c.id, lid);
        }
    }
}
