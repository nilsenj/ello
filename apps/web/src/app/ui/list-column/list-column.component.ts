import {Component, computed, inject, Input, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
    CdkDrag,
    CdkDragDrop,
    CdkDragHandle,
    CdkDropList,
    moveItemInArray,
    transferArrayItem
} from '@angular/cdk/drag-drop';
import type {Card, ListDto} from '../../types';
import {CardsService} from '../../data/cards.service';
import {BoardStore} from '../../store/board-store.service';
import {FormsModule} from '@angular/forms';
import {between} from '../../utils/rank';
import {TrelloCardComponent} from "../trello-card/trello-card.component";

@Component({
    standalone: true,
    selector: 'list-column',
    imports: [CommonModule, FormsModule, CdkDropList, TrelloCardComponent, CdkDrag, CdkDragHandle],
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
    dropListId = computed(() => 'list-' + this.list.id);
    connectedTo = computed(() => this.store.lists().map(l => 'list-' + l.id));

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
        const src = event.previousContainer.data;
        const dst = event.container.data;

        // Prefer the actual card object from the drag (survives filtering);
        // fall back to array lookup if not provided.
        const moved: Card =
            (event.item.data as Card) ??
            (event.previousContainer === event.container
                ? src[event.previousIndex]
                : src[event.previousIndex]);

        if (event.previousContainer === event.container) {
            // Reorder within the same list
            if (event.previousIndex === event.currentIndex) return;

            moveItemInArray(dst, event.previousIndex, event.currentIndex);

            const beforeCard = dst[event.currentIndex - 1] ?? undefined;
            const afterCard  = dst[event.currentIndex + 1] ?? undefined;
            const nextRank   = between(beforeCard?.rank ?? null, afterCard?.rank ?? null);

            await this.cardsApi.moveCard(
                moved.id,
                this.list.id,
                beforeCard?.id,
                afterCard?.id
            );

            moved.rank = nextRank;
            return;
        }

        // Move across lists
        transferArrayItem(src, dst, event.previousIndex, event.currentIndex);

        const beforeCard = dst[event.currentIndex - 1] ?? undefined;
        const afterCard  = dst[event.currentIndex + 1] ?? undefined;
        const nextRank   = between(beforeCard?.rank ?? null, afterCard?.rank ?? null);

        await this.cardsApi.moveCard(
            moved.id,
            this.list.id,       // destination list
            beforeCard?.id,     // undefined when none
            afterCard?.id
        );

        moved.rank = nextRank;
        moved.listId = this.list.id;
    }
}
