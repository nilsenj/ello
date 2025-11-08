import {Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardsService} from '../../data/cards.service';
import {ClickOutsideDirective} from "../click-outside.directive";
import {Card} from "../../types";
import {BoardStore} from "../../store/board-store.service";
import {FormsModule} from "@angular/forms";
import {LabelsService} from "../../data/labels.service";
import {CardModalService} from "../card-modal/card-modal.service";

@Component({
    standalone: true,
    selector: 'trello-card',
    imports: [CommonModule, ClickOutsideDirective, FormsModule],
    templateUrl: './trello-card.component.html',
})
export class TrelloCardComponent {
    @Input({required: true}) card!: Card;
    @Input({required: true}) listId!: string;

    showLabels = false;
    showMore = false;
    editing = false;
    titleDraft = '';

    constructor(
        public store: BoardStore,
        private cardsApi: CardsService,
        private labelsApi: LabelsService,
        private modal: CardModalService) {
    }

    openModal(ev: MouseEvent) {
        // Don’t open if user clicked a control inside
        const target = ev.target as HTMLElement;
        if (target.closest('button, a, input, textarea, [data-stop-open]')) return;
        ev.stopPropagation();
        this.modal.open(this.card.id);
    }

    startEdit() {
        this.titleDraft = this.card.title ?? '';
        this.editing = true;
        this.showMore = false;
        this.showLabels = false;
    }

    cancelEdit() {
        this.editing = false;
    }

    async saveEdit() {
        const next = (this.titleDraft ?? '').trim();
        if (!next || next === this.card.title) {
            this.editing = false;
            return;
        }
        await this.cardsApi.updateCard(this.card.id, {title: next});
        this.store.patchCardTitleLocally?.(this.card.id, next);
        this.editing = false;
    }

    async delete() {
        await this.cardsApi.deleteCard(this.card.id);
        this.store.removeCardLocally?.(this.card.id);
        this.showMore = false;
    }

    // robustly get label IDs from various backend shapes
    labelIds(card: Card): string[] {
        const any = card as any;
        if (Array.isArray(any.labelIds)) return any.labelIds.filter(Boolean);
        if (Array.isArray(any.labels)) return any.labels.map((x: any) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
        if (Array.isArray(any.cardLabels)) return any.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
        return [];
    }

    has = (lid: string) => this.labelIds(this.card).includes(lid);

    async toggleLabel(lid: string) {
        if (this.has(lid)) {
            await this.labelsApi.unassignFromCard(this.card.id, lid);
            this.store.removeLabelFromCardLocally(this.card.id, lid);
        } else {
            await this.labelsApi.assignToCard(this.card.id, lid);
            this.store.addLabelToCardLocally(this.card.id, lid);
        }
    }

    // ----- Rank (move within same list) -----
    private getListCards() {
        const list = this.store.lists().find((l: { id: string }) => l.id === this.listId);
        return list ? (list.cards ?? []) : [];
    }

    private indexInList() {
        return this.getListCards().findIndex(c => c.id === this.card.id);
    }

    async moveTop() {
        const cards = this.getListCards();
        if (!cards.length) return;

        const beforeId = undefined;                        // no item before
        const afterId = cards[0]?.id === this.card.id ? cards[1]?.id : cards[0]?.id;

        await this.cardsApi.moveCard(this.card.id, this.listId, beforeId, afterId);
        // local optimistic update
        const idx = this.indexInList();
        if (idx > 0) {
            cards.splice(idx, 1);
            cards.unshift(this.card);
        }
        this.showMore = false;
    }

    async moveBottom() {
        const cards = this.getListCards();
        if (!cards.length) return;

        const lastIdx = cards.length - 1;
        const beforeId = cards[lastIdx]?.id === this.card.id ? cards[lastIdx - 1]?.id : cards[lastIdx]?.id;
        const afterId = undefined;                        // no item after

        await this.cardsApi.moveCard(this.card.id, this.listId, beforeId, afterId);
        // local optimistic update
        const idx = this.indexInList();
        if (idx > -1 && idx < cards.length - 1) {
            cards.splice(idx, 1);
            cards.push(this.card);
        }
        this.showMore = false;
    }

    async moveUp() {
        const cards = this.getListCards();
        const idx = this.indexInList();
        if (idx <= 0) return;

        // target is one above
        const beforeId = cards[idx - 2]?.id;  // item before the target slot
        const afterId = cards[idx - 1]?.id;  // the item that will be right after us

        await this.cardsApi.moveCard(this.card.id, this.listId, beforeId, afterId);
        // local optimistic update
        cards.splice(idx, 1);
        cards.splice(idx - 1, 0, this.card);
        this.showMore = false;
    }

    async moveDown() {
        const cards = this.getListCards();
        const idx = this.indexInList();
        if (idx === -1 || idx >= cards.length - 1) return;

        // target is one below
        const beforeId = cards[idx + 1]?.id;  // the item that will be right before us
        const afterId = cards[idx + 2]?.id;  // the item after the target slot (may be undefined)

        await this.cardsApi.moveCard(this.card.id, this.listId, beforeId, afterId);
        // local optimistic update
        cards.splice(idx, 1);
        cards.splice(idx + 1, 0, this.card);
        this.showMore = false;
    }

    labelColor = (id: string) =>
        this.store.labels().find((l) => l.id === id)?.color ?? '#ccc';

    labelName = (id: string) =>
        this.store.labels().find((l) => l.id === id)?.name ?? '';


    onEditKeydown($event: KeyboardEvent) {

    }
}
