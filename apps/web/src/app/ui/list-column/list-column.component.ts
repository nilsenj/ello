import { Component, computed, inject, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    CdkDrag,
    CdkDragDrop,
    CdkDragHandle,
    CdkDropList,
    moveItemInArray,
    transferArrayItem
} from '@angular/cdk/drag-drop';
import type { Card, ListDto } from '../../types';
import { CardsService } from '../../data/cards.service';
import { ListsService } from '../../data/lists.service';
import { BoardStore } from '../../store/board-store.service';
import { FormsModule } from '@angular/forms';
import { between } from '../../utils/rank';
import { TrelloCardComponent } from "../trello-card/trello-card.component";

import { LucideAngularModule, Archive, X } from 'lucide-angular';

@Component({
    standalone: true,
    selector: 'list-column',
    imports: [CommonModule, FormsModule, CdkDropList, TrelloCardComponent, CdkDrag, CdkDragHandle, LucideAngularModule],
    styleUrls: ['./list-column.component.css'],
    templateUrl: './list-column.component.html'
})
export class ListColumnComponent {
    private _list = signal<ListDto>({} as ListDto);
    @Input({ required: true })
    set list(val: ListDto) {
        this._list.set(val);
    }
    get list(): ListDto {
        return this._list();
    }

    @Input() filtered: Card[] | null = null;
    @Input() canEdit = true;

    store = inject(BoardStore);
    cardsApi = inject(CardsService);
    listsApi = inject(ListsService);

    // Icons
    readonly ArchiveIcon = Archive;
    readonly XIcon = X;
    readonly tArchiveListTitle = $localize`:@@listColumn.archiveListTitle:Archive list`;
    readonly tDropCardsHere = $localize`:@@listColumn.dropCardsHere:Drop cards here`;
    readonly tAddCard = $localize`:@@listColumn.addCard:+ Add a card`;
    readonly tCardTitlePlaceholder = $localize`:@@listColumn.cardTitlePlaceholder:Enter a title for this card...`;
    readonly tAddCardButton = $localize`:@@listColumn.addCardButton:Add card`;
    readonly tCancel = $localize`:@@listColumn.cancel:Cancel`;
    readonly tArchiveListHeading = $localize`:@@listColumn.archiveListHeading:Archive list`;
    readonly tArchivePrompt = (name: string) =>
        $localize`:@@listColumn.archivePrompt:Are you sure you want to archive ${name}:listName:?`;
    readonly tArchiveHint = $localize`:@@listColumn.archiveHint:You can restore it later from the board menu.`;
    readonly tArchiveConfirm = $localize`:@@listColumn.archiveConfirm:Archive`;
    readonly tClose = $localize`:@@listColumn.close:Close`;

    newTitle = '';
    adding = signal(false);
    showArchiveModal = signal(false);
    disableCardClick = signal(false);

    title = computed(() => {
        const l = this._list();
        return l.title ?? l.name ?? '';
    });
    // Only show active cards in the column
    cards = computed<Card[]>(() => {
        const l = this._list();
        const all = Array.isArray(l.cards) ? l.cards! : [];
        return all.filter(c => !c.isArchived);
    });
    dropListId = computed(() => 'list-' + this._list().id);
    connectedTo = computed(() => this.store.lists().map(l => 'list-' + l.id));

    trackCard = (_: number, c: Card) => c.id;

    onDragStart() {
        if (!this.canEdit) return;
        this.disableCardClick.set(true);
    }

    onDragEnd() {
        if (!this.canEdit) return;
        // Small delay to ensure click event is ignored
        setTimeout(() => {
            this.disableCardClick.set(false);
        }, 50);
    }

    async createCard() {
        if (!this.canEdit) return;
        const t = this.newTitle.trim();
        if (!t) return;
        await this.cardsApi.createCard(this.list.id, t);
        this.newTitle = '';
        this.adding.set(false);
    }

    cancel() { this.newTitle = ''; this.adding.set(false); }

    requestArchive() {
        this.showArchiveModal.set(true);
    }

    closeArchiveModal() {
        this.showArchiveModal.set(false);
    }

    async confirmArchive() {
        this.showArchiveModal.set(false);
        await this.listsApi.updateList(this.list.id, { isArchived: true });
        // Update store to reflect archived state (KanbanBoardComponent will filter it out)
        const current = this.store.lists();
        this.store.setLists(current.map(l => l.id === this.list.id ? { ...l, isArchived: true } : l));
    }

    async onDrop(event: CdkDragDrop<Card[]>) {
        if (!this.canEdit) return;
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
            const afterCard = dst[event.currentIndex + 1] ?? undefined;
            const nextRank = between(beforeCard?.rank ?? null, afterCard?.rank ?? null);

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
        const afterCard = dst[event.currentIndex + 1] ?? undefined;
        const nextRank = between(beforeCard?.rank ?? null, afterCard?.rank ?? null);

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
