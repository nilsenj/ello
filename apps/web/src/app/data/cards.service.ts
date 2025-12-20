// apps/web/src/app/data/cards.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiBaseService } from './api-base.service';
import type { Card, CommentDto } from '../types';
import { ListsService } from './lists.service';
import { BoardStore } from '../store/board-store.service';

/** Mirror of your Prisma enum CardRole */
export type CardRole =
    | 'developer'
    | 'designer'
    | 'qa'
    | 'analyst'
    | 'pm'
    | 'devops'
    | 'other';

/** Shape returned by POST /cards/:cardId/assignees and PATCH /.../role (select) */
export type CardAssigneeRoleDto = {
    userId: string;
    role: CardRole | null;
    customRole: string | null;
};

@Injectable({ providedIn: 'root' })
export class CardsService {
    constructor(
        private api: ApiBaseService,
        private listsSvc: ListsService,
        private http: HttpClient,
        private store: BoardStore
    ) { }

    /** Create on server and return the created card */
    async createCard(listId: string, title: string): Promise<Card> {
        const created = await this.api.post<Card>(`/api/lists/${listId}/cards`, { title });
        // Merge into store (server is source of truth)
        this.store.upsertCardLocally(listId, created);
        return created;
    }

    /**
     * Public helper that performs optimistic UI + reverts on failure.
     * Prefer calling this from components.
     */
    async createCardInList(listId: string, title: string) {
        const lists = this.store.lists();
        const idx = lists.findIndex(l => l.id === listId);
        if (idx === -1) throw new Error('List not found');

        const optimistic: Card = {
            // @ts-ignore: minimal shape for UI while pending
            id: `tmp_${Math.random().toString(36).slice(2)}`,
            title,
            description: '',
            listId,
            rank: 'n',
            // @ts-ignore
            labelIds: [],
        };

        // optimistic insert
        const snapshot = this.store.lists();
        const clone = structuredClone(snapshot);
        clone[idx].cards = [...(clone[idx].cards ?? []), optimistic];
        this.store.setLists(clone);

        try {
            // Call API directly without calling createCard to avoid double insertion
            const created = await this.api.post<Card>(`/api/lists/${listId}/cards`, { title });

            // Replace optimistic card with real one
            const fresh = this.store.lists();
            const i2 = fresh.findIndex(l => l.id === listId);
            if (i2 !== -1) {
                const withReal = (fresh[i2].cards ?? []).map(c =>
                    c.id === optimistic.id ? created : c
                );
                const next = [...fresh];
                next[i2] = { ...fresh[i2], cards: withReal };
                this.store.setLists(next);
            }
            return created;
        } catch (e) {
            // revert optimistic entry
            const fresh = this.store.lists();
            const i2 = fresh.findIndex(l => l.id === listId);
            if (i2 !== -1) {
                const withoutTmp = (fresh[i2].cards ?? []).filter(c => c.id !== optimistic.id);
                const next = [...fresh];
                next[i2] = { ...fresh[i2], cards: withoutTmp };
                this.store.setLists(next);
            }
            throw e;
        }
    }

    async moveCard(id: string, toListId: string, beforeId?: string | null, afterId?: string | null) {
        const updated = await this.api.post<Card>(`/api/cards/${id}/move`, { toListId, beforeId, afterId });

        // local reorder: remove everywhere then insert into target near before/after
        const arr = this.store.lists();
        const stripped = arr.map(l => ({ ...l, cards: (l.cards ?? []).filter(c => c.id !== id) }));
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
            return { ...l, cards };
        });
        this.store.setLists(next);
    }

    async reorderWithinList(cardId: string, listId: string, beforeId?: string, afterId?: string) {
        return this.moveCard(cardId, listId, beforeId, afterId);
    }

    async updateCard(id: string, patch: Partial<{ title: string; description: string }>) {
        await this.api.patch(`/api/cards/${id}`, patch);
        if (patch.title) this.store.patchCardTitleLocally(id, patch.title);
    }

    async deleteCard(id: string) {
        await this.api.delete(`/api/cards/${id}`);
        this.store.removeCardLocally(id);
    }

    async addLabel(cardId: string, labelId: string) {
        // optimistic update
        (this.store.addLabelToCardLocally ?? this.store.addLabelToCard)?.(cardId, labelId);
        try {
            await this.api.post(`/api/cards/${cardId}/labels`, { labelId });
        } catch (err) {
            (this.store.removeLabelFromCardLocally ?? this.store.removeLabelFromCard)?.(cardId, labelId);
            throw err;
        }
    }

    async removeLabel(cardId: string, labelId: string) {
        (this.store.removeLabelFromCardLocally ?? this.store.removeLabelFromCard)?.(cardId, labelId);
        try {
            await this.api.delete(`/api/cards/${cardId}/labels/${labelId}`);
        } catch (err) {
            (this.store.addLabelToCardLocally ?? this.store.addLabelToCard)?.(cardId, labelId);
            throw err;
        }
    }

    async getCard(id: string) {
        return this.api.get<any>(`/api/cards/${id}`);
    }

    async patchCardExtended(
        id: string,
        body: Partial<{
            title: string;
            description: string;
            startDate: string | null;
            dueDate: string | null;
            priority: 'low' | 'medium' | 'high' | 'urgent' | null;
            risk: 'low' | 'medium' | 'high' | null;
            estimate: number | null;
            isArchived: boolean;
            isDone?: boolean;
            isDeleted?: boolean;
        }>
    ) {
        // use HttpClient to get Authorization + refresh from interceptor
        const res = await this.api.patch<Card>(`/api/cards/${id}/extended`, body);
        this.store.patchCardLocally(id, body);
        return res;
    }

    /** Assign a user to a card. Server returns { userId, role, customRole }. */
    async assignMember(cardId: string, userId: string): Promise<CardAssigneeRoleDto> {
        return this.api.post<CardAssigneeRoleDto>(`/api/cards/${cardId}/assignees`, { userId });
    }

    async unassignMember(cardId: string, userId: string) {
        return this.api.delete(`/api/cards/${cardId}/assignees/${userId}`);
    }

    /**
     * Set a functional role for a card assignee.
     * If role !== 'other', customRole is ignored on the server side.
     */
    setAssigneeRole(cardId: string, userId: string, body: { role: CardRole | null, customRole?: string | null }) {
        return this.api.patch<{ userId: string; role: string | null; customRole: string | null }>(
            `/api/cards/${cardId}/assignees/${userId}/role`,
            { role: body.role, customRole: body.customRole ?? null }
        );
    }

    // ---------- Checklists ----------
    async addChecklist(cardId: string, body: { title: string }) {
        return this.api.post(`/api/cards/${cardId}/checklists`, body);
    }
    async updateChecklist(checklistId: string, body: { title: string }) {
        return this.api.patch(`/api/checklists/${checklistId}`, body);
    }
    async addChecklistItem(checklistId: string, body: { text: string }) {
        return this.api.post(`/api/checklists/${checklistId}/items`, body);
    }
    async updateChecklistItem(itemId: string, body: { done?: boolean; text?: string }) {
        return this.api.patch(`/api/checklist-items/${itemId}`, body);
    }
    async deleteChecklist(checklistId: string) {
        return this.api.delete<void>(`/api/checklists/${checklistId}`);
    }
    async deleteChecklistItem(itemId: string) {
        return this.api.delete<void>(`/api/checklist-items/${itemId}`);
    }

    // ---------- Comments ----------
    addComment(cardId: string, body: { text: string }) {
        return this.api.post<CommentDto>(`/api/cards/${cardId}/comments`, body);
    }
    deleteComment(commentId: string) {
        return this.api.delete<void>(`/api/comments/${commentId}`);
    }

    // ---------- Activity ----------
    getCardActivity(cardId: string, limit = 20, offset = 0) {
        return this.api.get<any[]>(`/api/cards/${cardId}/activity?limit=${limit}&offset=${offset}`);
    }

    // ---------- Actions ----------
    async archiveCard(cardId: string) {
        // Keep the card in local store as archived so it appears in the board menu
        // under "Archived items" and can be restored.
        await this.patchCardExtended(cardId, { isArchived: true });
    }

    async copyCard(cardId: string, toListId: string, title?: string) {
        const created = await this.api.post<Card>(`/api/cards/${cardId}/copy`, { toListId, title });
        this.store.upsertCardLocally(toListId, created);
        return created;
    }

    // ---------- Relations (for diagram) ----------
    getCardRelations(cardId: string): Promise<{
        outgoing: { id: string; type: string; card: { id: string; title: string; listId: string } }[];
        incoming: { id: string; type: string; card: { id: string; title: string; listId: string } }[];
    }> {
        return this.api.get(`/api/cards/${cardId}/relations`);
    }

    createCardRelation(cardId: string, targetCardId: string, type: 'blocks' | 'depends_on' | 'relates_to' | 'duplicates') {
        return this.api.post(`/api/cards/${cardId}/relations`, { targetCardId, type });
    }

    deleteCardRelation(relationId: string) {
        return this.api.delete(`/api/relations/${relationId}`);
    }
}
