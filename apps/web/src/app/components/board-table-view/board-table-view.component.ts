import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoardStore } from '../../store/board-store.service';
import type { Card } from '../../types';
import { CardModalService, PanelName } from "../../ui/card-modal/card-modal.service";
import { CardsService } from '../../data/cards.service';
import { ListsService } from '../../data/lists.service';

@Component({
    selector: 'board-table-view',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './board-table-view.component.html',
    styleUrls: ['./board-table-view.component.css']
})
export class BoardTableViewComponent {
    store = inject(BoardStore);
    modal = inject(CardModalService);
    cardsApi = inject(CardsService);
    listsApi = inject(ListsService);

    @Input() canEdit = true;

    private _cards: Card[] = [];
    @Input() set cards(val: Card[]) {
        this._cards = val;
        // console.log('TableView Cards Check:', val.length, val[0]); 
        // We will inspect if listId is present
    }
    get cards(): Card[] { return this._cards; }


    // Sorting
    sortColumn: 'title' | 'list' | 'dueDate' | 'rank' = 'rank';
    sortDirection: 'asc' | 'desc' = 'asc';

    // New card
    showNewCardRow = false;
    newCardTitle = '';
    newCardListId = '';

    lists = () => this.store.lists().filter(l => !l.isArchived);
    labels = () => this.store.labels();

    getAllCards(): Card[] {
        let allCards = [...this.cards];

        // Sort
        return allCards.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            switch (this.sortColumn) {
                case 'title':
                    valA = a.title.toLowerCase();
                    valB = b.title.toLowerCase();
                    break;
                case 'list':
                    valA = this.getListName(a.listId).toLowerCase();
                    valB = this.getListName(b.listId).toLowerCase();
                    break;
                case 'dueDate':
                    valA = a.dueDate || '';
                    valB = b.dueDate || '';
                    break;
                case 'rank':
                    // Default to list rank then card rank
                    if (a.listId !== b.listId) {
                        const listA = this.lists().find(l => l.id === a.listId);
                        const listB = this.lists().find(l => l.id === b.listId);
                        // We don't have list rank easily accessible here without more lookup logic or relying on store order
                        // But we can use the index in the lists array
                        const idxA = this.lists().indexOf(listA!);
                        const idxB = this.lists().indexOf(listB!);
                        valA = idxA;
                        valB = idxB;
                    } else {
                        valA = a.rank || '';
                        valB = b.rank || '';
                    }
                    break;
            }

            if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    sort(column: any) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
    }

    getListName(listId: string) {
        return this.lists().find(l => l.id === listId)?.title || 'Unknown';
    }

    openCard(cardId: string, panel: PanelName | null = null) {
        this.modal.open(cardId, panel);
    }

    getLabelColor(labelId: string): string {
        return this.store.labels().find(l => l.id === labelId)?.color || '#ccc';
    }



    // Local toggle methods for header hidden/removed, but keeping helpers if used by template or remove entirely?
    // User wants "Unified filters", so local toggle filters are likely to be removed.
    // I will remove the logic.


    getMemberInitials(userId: string): string {
        const m = this.store.members().find(x => x.id === userId);
        return (m?.name || 'U').slice(0, 2).toUpperCase();
    }

    getMemberName(userId: string): string {
        const m = this.store.members().find(x => x.id === userId);
        return m?.name || 'Unknown User';
    }

    trackCard(_: number, item: Card): string {
        return item.id;
    }



    // Updates
    async updateCardTitle(card: Card, event: Event) {
        if (!this.canEdit) return;
        const input = event.target as HTMLInputElement;
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== card.title) {
            await this.cardsApi.updateCard(card.id, { title: newTitle });
        }
    }

    async updateCardList(card: Card, event: Event) {
        if (!this.canEdit) return;
        const select = event.target as HTMLSelectElement;
        const newListId = select.value;
        if (!newListId || newListId === card.listId) return;
        await this.cardsApi.moveCard(card.id, newListId, null, null);
    }

    async updateDueDate(card: Card, dateStr: string | null) {
        if (!this.canEdit) return;
        await this.cardsApi.patchCardExtended(card.id, { dueDate: dateStr || null });
    }

    async updateCardList(card: Card, event: Event) {
        const select = event.target as HTMLSelectElement;
        const newListId = select.value;
        if (newListId && newListId !== card.listId) {
            // we need rank... simplified move for now
            await this.cardsApi.moveCard(card.id, newListId, null, null);
        }
    }

    async updateDueDate(card: Card, dateStr: string) {
        await this.cardsApi.patchCardExtended(card.id, { dueDate: dateStr || null });
    }

    async createCard() {
        if (!this.newCardTitle.trim() || !this.newCardListId) return;
        await this.cardsApi.createCard(this.newCardListId, this.newCardTitle);
        this.newCardTitle = '';
        this.showNewCardRow = false;
    }

    debug() {
        console.log('Lists:', this.lists());
        console.log('Cards:', this.getAllCards());
    }
}
