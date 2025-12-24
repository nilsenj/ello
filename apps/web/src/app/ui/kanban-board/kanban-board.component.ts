import { Component, computed, effect, ElementRef, inject, OnInit, ViewChild, signal } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    CdkDrag,
    CdkDragDrop,
    CdkDragPlaceholder,
    CdkDragPreview,
    CdkDropList,
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
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CardModalComponent } from "../card-modal/card-modal.component";

import { BoardMenuComponent } from "../board-menu/board-menu.component";
import { BoardTableViewComponent } from "../../components/board-table-view/board-table-view.component";
import { BoardCalendarViewComponent } from "../../components/board-calendar-view/board-calendar-view.component";
import { LucideAngularModule, FilterIcon, SearchIcon, UserIcon, TagIcon } from 'lucide-angular';
import { WorkspacesService } from '../../data/workspaces.service';
import { AuthService } from '../../auth/auth.service';

@Component({
    selector: 'kanban-board',
    standalone: true,
    imports: [NgFor, NgIf, FormsModule, ListColumnComponent, CardModalComponent, CdkDropList, CdkDrag, CdkDragPreview, CdkDragPlaceholder, NgClass, BoardMenuComponent, RouterLink, BoardTableViewComponent, BoardCalendarViewComponent, LucideAngularModule], // ⬅️ include group

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
    workspacesApi = inject(WorkspacesService);
    authService = inject(AuthService);
    route = inject(ActivatedRoute);
    router = inject(Router);

    // View State
    currentView = signal<'board' | 'table' | 'calendar'>('board');
    boardId = computed(() => this.store.currentBoardId());

    // popovers per card
    showLabels: Record<string, boolean> = {};
    showLabelDropdown = false;
    showMemberDropdown = false;

    readonly FilterIcon = FilterIcon;
    readonly SearchIcon = SearchIcon;
    readonly UserIcon = UserIcon;
    readonly TagIcon = TagIcon;

    @ViewChild('newListInput') newListInput!: ElementRef<HTMLInputElement>;

    focusNewList() {
        // scroll to rightmost
        const scrollContainer = document.querySelector('.overflow-x-auto');
        if (scrollContainer) {
            scrollContainer.scrollTo({ left: scrollContainer.scrollWidth, behavior: 'smooth' });
        }
        // focus input
        setTimeout(() => {
            this.newListInput?.nativeElement?.focus();
            if (!this.newListTitle) this.newListTitle = ''; // Ensure field maps to something to trigger UI if using ngIf
        }, 300);
    }


    // ui state
    showViewMenu = false;
    showFilterMenu = false;

    toggleViewMenu() {
        this.showViewMenu = !this.showViewMenu;
        if (this.showViewMenu) this.showFilterMenu = false;
    }

    closeViewMenu() {
        this.showViewMenu = false;
    }

    toggleFilterMenu() {
        this.showFilterMenu = !this.showFilterMenu;
        if (this.showFilterMenu) this.showViewMenu = false;
    }

    closeFilterMenu() {
        this.showFilterMenu = false;
    }

    activeLabelName() {
        if (!this.activeLabel) return 'All labels';
        return this.store.labels().find(l => l.id === this.activeLabel)?.name || 'Label';
    }

    activeMemberName() {
        if (!this.activeMemberId) return 'All members';
        const m = this.store.members().find(m => m.id === this.activeMemberId);
        return m?.name || m?.email || 'Member';
    }

    activeMemberInitials() {
        if (!this.activeMemberId) return '';
        const m = this.store.members().find(m => m.id === this.activeMemberId);
        const name = (m?.name || m?.email || 'M').trim();
        return name.slice(0, 2).toUpperCase();
    }


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

    workspaces = signal<any[]>([]);

    canEditBoard = computed(() => {
        const uid = this.authService.user()?.id;
        if (!uid) return false;
        const me = this.store.members().find(m => m.id === uid || m.userId === uid);
        return me?.role === 'owner' || me?.role === 'admin' || me?.role === 'member';
    });

    showWorkspaceViewerBanner = computed(() => {
        const boardId = this.store.currentBoardId();
        if (!boardId) return false;
        const board = this.store.boards().find(b => b.id === boardId);
        if (!board?.workspaceId) return false;
        const uid = this.authService.user()?.id;
        if (!uid) return false;
        const ws = this.workspaces().find(w => w.id === board.workspaceId);
        if (!ws) return false;
        const isBoardMember = this.store.members().some(m => (m.id === uid || m.userId === uid));
        return Boolean(ws && !isBoardMember);
    });

    constructor() {
        this.boardsApi.loadBoards();

        // Deep-link: open when ?card=ID is present
        this.route.queryParamMap.subscribe(q => {
            const id = q.get('card');
            if (id) this.modal.open(id);

            const view = q.get('view');
            this.currentView.set((['board', 'table', 'calendar'].includes(view as any) ? view : 'board') as any);
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

        // If it's an image URL, don't apply CSS classes (use inline style instead)
        if (bg && bg.startsWith('http')) {
            return 'bg-cover bg-center bg-no-repeat';
        }

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

    // Computed signal for image background style (returns null or url(...) style)
    boardBackgroundStyle = computed(() => {
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        const bg = board?.background;

        if (bg && bg.startsWith('http')) {
            return `url(${bg})`;
        }
        return null;
    });

    isLightBoard = computed(() => {
        const board = this.store.boards().find(b => b.id === this.store.currentBoardId());
        const bg = board?.background;

        // Light backgrounds: no background, 'none', empty string, null, or bg-slate-50 (default)
        if (!bg || bg === 'none' || bg === '' || bg === 'bg-slate-50') {
            return true;
        }

        // Image backgrounds are typically scenic photos with good contrast, treat as dark
        // You might want to analyze the image color in the future
        return false;
    });

    // whenever modal opens/closes, sync query param
    ngOnInit() {
        this.workspacesApi.list().then(list => this.workspaces.set(list)).catch(() => this.workspaces.set([]));
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

    matchesFilter(c: Card): boolean {
        const q = this.filter.trim().toLowerCase();
        if (q && !(c.title ?? '').toLowerCase().includes(q)) return false;

        if (this.activeLabel) {
            const ids = Array.isArray(c.labelIds) ? c.labelIds :
                (Array.isArray((c as any).labels) ? (c as any).labels.map((x: any) => (typeof x === 'string' ? x : x?.id ?? x?.labelId)).filter(Boolean) : []);
            if (!ids.includes(this.activeLabel)) return false;
        }

        if (this.activeMemberId) {
            const memberIds = Array.isArray(c.assignees) ? c.assignees.map((x: any) => x?.userId || x?.id).filter(Boolean) : [];
            if (!memberIds.includes(this.activeMemberId)) return false;
        }

        return true;
    }

    getAllFilteredCards(): Card[] {
        const lists = this.store.lists();
        const allCards: Card[] = [];
        for (const l of lists) {
            if (l.cards) {
                // Ensure listId is present on the card object, as it might be missing in nested responses
                const cardsWithListId = l.cards.map(c => ({ ...c, listId: l.id }));
                allCards.push(...cardsWithListId);
            }
        }
        // Unique by ID if any dupes exist (safeguard)
        const unique = Array.from(new Map(allCards.map(c => [c.id, c])).values());
        return unique.filter(c =>
            !c.isArchived && this.matchesFilter(c)
        );
    }

    // filtering logic
    cards = (listId: string) => {
        const list = this.store.lists().find(x => x.id === listId);
        if (!list || !list.cards) return [];

        return list.cards.filter(c =>
            !c.isArchived && this.matchesFilter(c)
        );
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

    toggleLabelDropdown() {
        this.showLabelDropdown = !this.showLabelDropdown;
        this.showMemberDropdown = false;
    }

    toggleMemberDropdown() {
        this.showMemberDropdown = !this.showMemberDropdown;
        this.showLabelDropdown = false;
    }

    closeAllDropdowns() {
        this.showLabelDropdown = false;
        this.showMemberDropdown = false;
    }
}
