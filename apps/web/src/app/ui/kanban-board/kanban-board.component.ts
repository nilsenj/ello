import {Component, effect, inject, OnInit} from '@angular/core';
import {NgFor, NgIf} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {CdkDragDrop, CdkDropListGroup, moveItemInArray, transferArrayItem,} from '@angular/cdk/drag-drop';
import type {Card, ListDto} from '../../types';
import {BoardStore} from '../../store/board-store.service';
import {BoardsService} from '../../data/boards.service';
import {ListsService} from '../../data/lists.service';
import {CardsService} from '../../data/cards.service';
import {ListColumnComponent} from "../list-column/list-column.component";
import {CardModalService} from "../card-modal/card-modal.service";
import {ActivatedRoute, Router} from "@angular/router";
import {CardModalComponent} from "../card-modal/card-modal.component";

@Component({
    selector: 'kanban-board',
    standalone: true,
    imports: [NgFor, NgIf, FormsModule, CdkDropListGroup, ListColumnComponent, CardModalComponent], // ⬅️ include group
    templateUrl: './kanban-board.component.html',
    styleUrls: ['./kanban-board.component.css'],
})
export class KanbanBoardComponent implements OnInit {
    // store + services
    store = inject(BoardStore);
    boardsApi = inject(BoardsService);
    listsApi = inject(ListsService);
    cardsApi = inject(CardsService);
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
    editingCard: Record<string, boolean> = {};
    cardTitles: Record<string, string> = {};

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
            const qp = isOpen && id ? {card: id} : {};
            this.router.navigate([], {queryParams: qp, queryParamsHandling: 'merge'});
        });
    }

    // whenever modal opens/closes, sync query param
    ngOnInit() {
    }

    // projections
    boards = () => this.store.boards();
    currentBoardId = () => this.store.currentBoardId();
    lists = () => this.store.lists();

    // header label filter handler (called from template)
    updateActiveLabel(val: string) {
        this.activeLabel = val || '';
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
                if (Array.isArray(c.labels)) return c.labels.map((x: any) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
                if (Array.isArray(c.cardLabels)) return c.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
                return [];
            };
            cards = cards.filter((c) => ids(c).includes(this.activeLabel));
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
        await this.cardsApi.updateCard(card.id, {title: next});
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
