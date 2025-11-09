import {Injectable} from '@angular/core';
import {ApiBaseService} from './api-base.service';
import type {Card, CommentDto} from '../types';
import {ListsService} from './lists.service';
import {firstValueFrom} from 'rxjs';
import {BoardStore} from "../store/board-store.service";
import {HttpClient, HttpHeaders} from "@angular/common/http";

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

    async assignMember(cardId: string, userId: string) {
        return this.http.post(`/api/cards/${cardId}/assignees`, { userId }).toPromise();
    }
    async unassignMember(cardId: string, userId: string) {
        return this.http.delete(`/api/cards/${cardId}/assignees/${userId}`).toPromise();
    }

    async addChecklist(cardId: string, body: { title: string }) {
        return this.http.post(`/api/cards/${cardId}/checklists`, body).toPromise() as Promise<any>;
    }
    async updateChecklist(checklistId: string, body: { title: string }) {
        return this.http.patch(`/api/checklists/${checklistId}`, body).toPromise();
    }
    async addChecklistItem(checklistId: string, body: { text: string }) {
        return this.http.post(`/api/checklists/${checklistId}/items`, body).toPromise() as Promise<any>;
    }
    async updateChecklistItem(itemId: string, body: { done?: boolean; text?: string }) {
        return this.http.patch(`/api/checklist-items/${itemId}`, body).toPromise();
    }

    addComment(cardId: string, body: { text: string }) {
        return firstValueFrom(
            this.http.post<CommentDto>(`/api/cards/${cardId}/comments`, body, this.withUser())
        );
    }

    deleteComment(commentId: string) {
        return firstValueFrom(
            this.http.delete<void>(`/api/comments/${commentId}`)
        );
    }

    private withUser(headers?: HttpHeaders) {
        const id = localStorage.getItem('userId') || 'demo-user';
        let h = headers || new HttpHeaders();
        h = h.set('x-user-id', id);
        return { headers: h };
    }
}
