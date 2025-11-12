// apps/web/src/app/data.service.ts
import {Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {BoardStore} from "./store/board-store.service";
import {Board, Card, ListDto} from "./types";

@Injectable({providedIn: 'root'})
export class DataService {
    boards = signal<{ id: string; name: string }[]>([]);
    currentBoardId = signal<string | null>(null);
    lists = signal<ListDto[]>([]);

    constructor(private http: HttpClient, private store: BoardStore) {
    }

    async loadBoards() {
        const boards = await firstValueFrom(this.http.get<Board[]>('/api/boards').pipe());
        this.store.setBoards(boards ?? []);
        if (boards?.length) await this.selectBoard(boards[0].id);
    }

    async selectBoard(boardId: string) {
        this.store.setCurrentBoardId(boardId);
        const lists = await firstValueFrom(this.http.get<ListDto[]>(`/api/boards/${boardId}/lists`));
        const normalized = (lists ?? []).map(l => ({
            ...l,
            title: (l as any).title ?? (l as any).name ?? '',
            cards: Array.isArray(l.cards) ? l.cards : [],
        }));
        this.store.setLists(normalized);
    }

    async updateListName(listId: string, name: string) {
        await this.http.patch(`/api/lists/${listId}`, {name}).toPromise();
        this.lists.update(arr =>
            arr.map(l => l.id === listId ? {...l, name, title: name} : l)
        );
    }

    async createList(name: string) {
        const boardId = this.currentBoardId();
        if (!boardId) return;
        const created = await firstValueFrom(
            this.http.post<ListDto>(`/api/boards/${boardId}/lists`, {name})
        );
        const normalized = {
            ...created,
            title: (created as any).title ?? (created as any).name ?? '',
            cards: Array.isArray(created.cards) ? created.cards : [],
        };
        this.lists.update(arr => [...arr, normalized]);
    }

    async createCard(listId: string, title: string) {
        const created = await firstValueFrom(
            this.http.post<Card>(`/api/lists/${listId}/cards`, {title})
        );
        this.lists.update(arr =>
            arr.map(l =>
                l.id === listId
                    ? {...l, cards: [...(l.cards ?? []), created]}
                    : l
            )
        );
    }

    async updateCard(id: string, patch: Partial<{ title: string; description: string }>) {
        await this.http.patch(`/api/cards/${id}`, patch).toPromise();
    }

    async deleteCard(id: string) {
        await this.http.delete(`/api/cards/${id}`).toPromise();
    }

    async moveCard(id: string, toListId: string, beforeId?: string | null, afterId?: string | null) {
        const updated = await firstValueFrom(
            this.http.post<Card>(`/api/cards/${id}/move`, {toListId, beforeId, afterId})
        );

        this.lists.update(arr => {
            // remove from any list
            const stripped = arr.map(l => ({...l, cards: (l.cards ?? []).filter(c => c.id !== id)}));
            // insert into target with before/after
            return stripped.map(l => {
                if (l.id !== toListId) return l;
                const cards = [...(l.cards ?? [])];
                if (beforeId) {
                    const idx = cards.findIndex(c => c.id === beforeId);
                    cards.splice(idx + 1, 0, updated);
                } else if (afterId) {
                    const idx = cards.findIndex(c => c.id === afterId);
                    cards.splice(Math.max(0, idx), 0, updated);
                } else {
                    cards.push(updated);
                }
                return {...l, cards};
            });
        });
    }
}
