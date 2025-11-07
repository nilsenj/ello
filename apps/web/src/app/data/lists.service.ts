// apps/web/src/app/data/lists.service.ts
import { Injectable, signal } from '@angular/core';
import { ApiBaseService } from './api-base.service';
import type { ListDto } from '../types';
import { firstValueFrom } from 'rxjs';
import { BoardStore } from '../store/board-store.service';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ListsService {
    lists = signal<ListDto[]>([]);

    constructor(
        private api: ApiBaseService,
        private http: HttpClient,
        private store: BoardStore
    ) {}

    private normalizeList(l: ListDto): ListDto {
        return {
            ...l,
            title: (l as any).title ?? (l as any).name ?? '',
            cards: Array.isArray(l.cards) ? l.cards : [],
        };
    }

    async loadLists(boardId: string) {
        const lists = await this.api.get<ListDto[]>(`/api/boards/${boardId}/lists`).catch(() => []);
        const normalized = (lists ?? []).map(l => this.normalizeList(l));
        this.lists.set(normalized);
        this.store.setLists(normalized); // <-- write into the store that the UI uses
    }

    async updateListName(listId: string, name: string) {
        await firstValueFrom(this.http.patch(`/api/lists/${listId}`, { name }));
        this.store.renameListLocally(listId, name);
    }

    async createList(name: string) {
        const boardId = this.store.currentBoardId();
        if (!boardId) return;
        const created = await firstValueFrom(
            this.http.post<ListDto>(`/api/boards/${boardId}/lists`, { name })
        );
        const normalized = this.normalizeList(created);
        this.store.setLists([...this.store.lists(), normalized]);
    }
}
