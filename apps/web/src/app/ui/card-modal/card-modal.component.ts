// apps/web/src/app/components/card-modal/card-modal.component.ts
import { Component, HostListener, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Card } from '../../types';
import { CardModalService } from './card-modal.service';
import { CardsService } from '../../data/cards.service';
import { BoardStore } from '../../store/board-store.service';
import { LabelsService } from '../../data/labels.service';

@Component({
    standalone: true,
    selector: 'card-modal',
    imports: [CommonModule, FormsModule],
    styleUrls: ['./card-modal.component.css'],
    templateUrl: './card-modal.component.html',
})
export class CardModalComponent {
    // services/stores
    modal = inject(CardModalService);
    cardsApi = inject(CardsService);
    labelsApi = inject(LabelsService);
    store = inject(BoardStore);

    // ui state
    loading = signal(false);
    data = signal<Card | null>(null);
    titleDraft = signal('');
    descDraft = signal('');

    get labelIds(): string[] {
        const c: any = this.data?.();
        if (!c) return [];
        if (Array.isArray(c.labelIds)) return c.labelIds.filter(Boolean);
        if (Array.isArray(c.labels))   return c.labels.map((x: any) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
        if (Array.isArray(c.cardLabels)) return c.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
        return [];
    }
    // internal: guards out-of-order async writes
    private reqToken = 0;

    constructor() {
        // react to modal state (isOpen + cardId); perform async fetch safely
        effect(() => {
            const isOpen = this.modal.isOpen();
            const id = this.modal.cardId();
            // when closed or id missing → clear local state
            if (!isOpen || !id) {
                this.loading.set(false);
                this.data.set(null);
                this.titleDraft.set('');
                this.descDraft.set('');
                return;
            }

            // ensure labels are present (lazy load once per board open)
            const boardId = this.store.currentBoardId();
            if (boardId && this.store.labels().length === 0) {
                // fire-and-forget is fine; effect allows writes below
                this.labelsApi.loadLabels(boardId).catch(() => {});
            }

            // async fetch with race protection
            const token = ++this.reqToken;
            this.loading.set(true);

            (async () => {
                try {
                    const card = await this.cardsApi.getCard(id);
                    if (this.reqToken !== token) return; // stale result, ignore
                    this.data.set(card);
                    this.titleDraft.set(card?.title ?? '');
                    this.descDraft.set(card?.description ?? '');
                } catch {
                    if (this.reqToken !== token) return;
                    this.data.set(null);
                } finally {
                    if (this.reqToken === token) this.loading.set(false);
                }
            })();
        }, { allowSignalWrites: true });
    }

    // ------- Labels helpers -------

    private currentLabelIds(): string[] {
        const c: any = this.data();
        if (!c) return [];
        if (Array.isArray(c.labelIds)) return c.labelIds.filter(Boolean);
        if (Array.isArray(c.labels))
            return c.labels.map((x: any) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
        if (Array.isArray(c.cardLabels))
            return c.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
        return [];
    }

    hasLabel = (lid: string) => this.currentLabelIds().includes(lid);

    async toggleLabel(lid: string) {
        const c = this.data();
        if (!c) return;

        if (this.hasLabel(lid)) {
            await this.labelsApi.unassignFromCard(c.id, lid);
            this.store.removeLabelFromCardLocally(c.id, lid);
            this.data.set({ ...c, labelIds: this.currentLabelIds().filter(id => id !== lid) } as any);
        } else {
            await this.labelsApi.assignToCard(c.id, lid);
            this.store.addLabelToCardLocally(c.id, lid);
            this.data.set({ ...c, labelIds: [...this.currentLabelIds(), lid] } as any);
        }
    }

    labelColor = (id: string) => this.store.labels().find(l => l.id === id)?.color ?? '#ccc';
    labelName  = (id: string) => this.store.labels().find(l => l.id === id)?.name ?? '';

    // ------- Save fields -------

    async saveTitle() {
        const c = this.data(); if (!c) return;
        const next = (this.titleDraft() ?? '').trim();
        if (!next || next === c.title) return;
        await this.cardsApi.updateCard(c.id, { title: next });
        this.store.patchCardTitleLocally?.(c.id, next);
        this.data.set({ ...c, title: next });
    }

    async saveDescription() {
        const c = this.data(); if (!c) return;
        const next = (this.descDraft() ?? '').trim();
        await this.cardsApi.patchCardExtended(c.id, { description: next || '' });
        this.data.set({ ...c, description: next });
    }

    async setDueDate(dateStr: string | null) {
        const c = this.data(); if (!c) return;
        await this.cardsApi.patchCardExtended(c.id, { dueDate: dateStr });
        this.data.set({ ...c, dueDate: dateStr } as any);
    }


    // ------- Close -------
    close() {
        // If your modal service also syncs with ?card=, call service.close() which updates URL
        this.modal.close();
        // local cleanup is handled by the effect reacting to isOpen=false
    }

    // ESC to close
    @HostListener('document:keydown.escape')
    onEsc() { if (this.modal.isOpen()) this.close(); }
}
