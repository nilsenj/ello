import {Injectable} from '@angular/core';
import {ApiBaseService} from './api-base.service';
import type {Card} from '../types';
import {ListsService} from './lists.service';
import {firstValueFrom} from 'rxjs';
import {BoardStore} from "../store/board-store.service";
import {HttpClient} from "@angular/common/http";

@Injectable({providedIn: 'root'})
export class CardsService {
    constructor(private api: ApiBaseService, private listsSvc: ListsService, private http: HttpClient, private store: BoardStore) {
    }

    async createCard(listId: string, title: string) {
        const created = await firstValueFrom(this.http.post<Card>(`/api/lists/${listId}/cards`, {title}));
        this.store.upsertCardLocally(listId, created);
    }

    async moveCard(id: string, toListId: string, beforeId?: string | null, afterId?: string | null) {
        const updated = await firstValueFrom(
            this.http.post<Card>(`/api/cards/${id}/move`, {toListId, beforeId, afterId})
        );

        // local optimistic reorder: remove everywhere then insert into target near before/after
        const arr = this.store.lists();
        const stripped = arr.map(l => ({...l, cards: (l.cards ?? []).filter(c => c.id !== id)}));
        const next = stripped.map(l => {
            if (l.id !== toListId) return l;
            const cards = [...(l.cards ?? [])];
            if (beforeId) {
                const idx = cards.findIndex(c => c.id === beforeId);
                cards.splice(Math.max(0, idx + 1), 0, updated);
            } else if (afterId) {
                const idx = cards.findIndex(c => c.id === afterId);
                cards.splice(Math.max(0, idx), 0, updated);
            } else {
                cards.push(updated);
            }
            return {...l, cards};
        });
        this.store.setLists(next);
    }

    async reorderWithinList(cardId: string, listId: string, beforeId?: string, afterId?: string) {
        return this.moveCard(cardId, listId, beforeId, afterId);
    }

    async updateCard(id: string, patch: Partial<{ title: string; description: string }>) {
        await firstValueFrom(this.http.patch(`/api/cards/${id}`, patch));
        if (patch.title) this.store.patchCardTitleLocally(id, patch.title);
    }

    async deleteCard(id: string) {
        await firstValueFrom(this.http.delete(`/api/cards/${id}`));
        this.store.removeCardLocally(id);
    }

    async addLabel(cardId: string, labelId: string) {
        // optimistic update
        (this.store.addLabelToCardLocally ?? this.store.addLabelToCard)?.(cardId, labelId);
        try {
            await firstValueFrom(this.http.post(`/api/cards/${cardId}/labels`, {labelId}));
        } catch (err) {
            // rollback on failure
            (this.store.removeLabelFromCardLocally ?? this.store.removeLabelFromCard)?.(cardId, labelId);
            throw err;
        }
    }

    async removeLabel(cardId: string, labelId: string) {
        // optimistic update
        (this.store.removeLabelFromCardLocally ?? this.store.removeLabelFromCard)?.(cardId, labelId);
        try {
            await firstValueFrom(this.http.delete(`/api/cards/${cardId}/labels/${labelId}`));
        } catch (err) {
            // rollback on failure
            (this.store.addLabelToCardLocally ?? this.store.addLabelToCard)?.(cardId, labelId);
            throw err;
        }
    }

    async getCard(id: string) {
        return this.api.get<any>(`/api/cards/${id}`);
    }

    async patchCardExtended(id: string, body: Partial<{
        title: string;
        description: string;
        startDate: string | null;
        dueDate: string | null;
        priority: string;
        isArchived: boolean;
    }>) {
        return this.api.patch(`/api/cards/${id}/extended`, body);
    }
}
