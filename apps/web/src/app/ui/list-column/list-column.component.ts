import {Component, computed, inject, Input, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';
import type {Card, ListDto} from '../../types';
import {CardsService} from '../../data/cards.service';
import {BoardStore} from '../../store/board-store.service';
import {FormsModule} from '@angular/forms';
import {between} from '../../utils/rank';
import {TrelloCardComponent} from "../trello-card/trello-card.component";

@Component({
    standalone: true,
    selector: 'list-column',
    imports: [CommonModule, FormsModule, CdkDropList, TrelloCardComponent, CdkDrag],
    styleUrls: ['./list-column.component.css'],
    templateUrl: './list-column.component.html'
})
export class ListColumnComponent {
    @Input({required: true}) list!: ListDto;
    @Input() filtered: Card[] | null = null;

    store = inject(BoardStore);
    cardsApi = inject(CardsService);

    newTitle = '';
    adding = signal(false);

    title = computed(() => this.list.title ?? this.list.name ?? '');
    cards = computed<Card[]>(() => Array.isArray(this.list.cards) ? this.list.cards! : []);

    trackCard = (_: number, c: Card) => c.id;

    async createCard() {
        const t = this.newTitle.trim();
        if (!t) return;
        await this.cardsApi.createCard(this.list.id, t);
        this.newTitle = '';
        this.adding.set(false);
    }

    cancel() { this.newTitle = ''; this.adding.set(false); }

    async onDrop(event: CdkDragDrop<Card[]>) {
        if (event.previousContainer === event.container) {
            // reordering within the same list
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);

            const arr    = event.container.data;
            const before = arr[event.currentIndex - 1]?.rank ?? null;
            const after  = arr[event.currentIndex + 1]?.rank ?? null;
            const newRank = between(before, after);
            const moved   = arr[event.currentIndex];

            // IMPORTANT: (beforeId, afterId) in this order
            await this.cardsApi.moveCard(
                moved.id,
                this.list.id,
                before ? arr[event.currentIndex - 1].id : undefined,
                after  ? arr[event.currentIndex + 1].id : undefined
            );
            moved.rank = newRank;
        } else {
            // moving across lists
            transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);

            const arr    = event.container.data;
            const before = arr[event.currentIndex - 1]?.rank ?? null;
            const after  = arr[event.currentIndex + 1]?.rank ?? null;
            const newRank = between(before, after);
            const moved   = arr[event.currentIndex];

            await this.cardsApi.moveCard(
                moved.id,
                this.list.id,
                before ? arr[event.currentIndex - 1].id : undefined,
                after  ? arr[event.currentIndex + 1].id : undefined
            );
            moved.rank  = newRank;
            moved.listId = this.list.id;
        }
    }
}
