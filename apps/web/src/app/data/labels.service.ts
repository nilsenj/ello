import {Injectable} from '@angular/core';
import {ApiBaseService} from './api-base.service';
import type {Label} from '../types';
import {BoardStore} from '../store/board-store.service';

@Injectable({providedIn: 'root'})
export class LabelsService {
    constructor(private api: ApiBaseService, private store: BoardStore) {
    }

    async loadLabels(boardId: string) {
        const labels = await this.api.get<Label[]>(`/api/boards/${boardId}/labels`).catch(() => []);
        this.store.setLabels(labels ?? []);
    }

    async createLabel(boardId: string, payload: Pick<Label, 'name' | 'color'>) {
        const created = await this.api.post<Label>(`/api/boards/${boardId}/labels`, payload);
        const next = [...this.store.labels(), created];
        this.store.setLabels(next.sort((a, b) => a.name.localeCompare(b.name)));
    }

    async renameLabel(id: string, patch: Partial<Pick<Label, 'name' | 'color'>>) {
        const updated = await this.api.patch<Label>(`/api/labels/${id}`, patch);
        this.store.setLabels(this.store.labels().map(l => l.id === id ? updated : l));
    }

    async deleteLabel(id: string) {
        await this.api.delete(`/api/labels/${id}`);
        this.store.setLabels(this.store.labels().filter(l => l.id !== id));
    }

    // Optional helpers for assign/unassign (if your API exposes these)
    async assignToCard(cardId: string, labelId: string) {
        await this.api.post(`/api/cards/${cardId}/labels`, { labelId });
        this.store.addLabelToCard(cardId, labelId);
    }

    async unassignFromCard(cardId: string, labelId: string) {
        await this.api.delete(`/api/cards/${cardId}/labels/${labelId}`);
        this.store.removeLabelFromCard(cardId, labelId);
    }
}
