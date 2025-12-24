// apps/web/src/app/data/boards.service.ts
import { of, map, switchMap, tap, firstValueFrom } from 'rxjs';
import { Injectable } from '@angular/core';
import { ApiBaseService } from './api-base.service';
import type { Board } from '../types';
import { BoardStore } from '../store/board-store.service';
import { ListsService } from './lists.service';
import { LabelsService } from "./labels.service";
import { HttpClient, HttpParams } from "@angular/common/http";

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type BoardMemberLite = { id: string; userId: string; name: string; email: string; avatar?: string; role: MemberRole; status?: 'active' | 'pending' };
@Injectable({ providedIn: 'root' })
export class BoardsService {
    constructor(
        private api: ApiBaseService,
        private store: BoardStore,
        private listsApi: ListsService,
        private labelsApi: LabelsService,
        private http: HttpClient
    ) {
    }

    async loadBoards(opts: { autoSelect?: boolean } = {}) {
        const { autoSelect = false } = opts;
        const boards = await this.api.get<Board[]>('/api/boards').catch(() => []);
        this.store.setBoards(boards ?? []);
        if (autoSelect && boards?.length) {
            await this.selectBoard(boards[0].id);
        }
    }

    async selectBoard(boardId: string) {
        // reflect selection in UI immediately
        this.store.setCurrentBoardId(boardId);
        this.addToRecent(boardId);

        const loadAll = () => Promise.all([
            this.listsApi.loadLists(boardId),
            this.labelsApi.loadLabels(boardId),
            this.searchMembers(boardId).then(m => this.store.setMembers(m)),
        ]);

        try {
            await loadAll();
        } catch (err: any) {
            const status = err?.status ?? err?.statusCode ?? err?.error?.statusCode;
            if (status === 403) {
                // Not a member yet → join and retry
                await this.api.post(`/api/boards/${boardId}/join`, {});
                await loadAll();
            } else {
                throw err;
            }
        }
    }

    private addToRecent(boardId: string) {
        if (typeof window === 'undefined') return; // SSR check
        try {
            const key = 'recent_boards';
            let recent: string[] = JSON.parse(localStorage.getItem(key) || '[]');
            // remove if exists, add to front
            recent = recent.filter(id => id !== boardId);
            recent.unshift(boardId);
            // keep max 4
            recent = recent.slice(0, 4);
            localStorage.setItem(key, JSON.stringify(recent));
        } catch (e) {
            // ignore
        }
    }

    async getMembers(boardId: string) {
        return this.api.get<{ id: string; name: string; avatar?: string }[]>(`/api/boards/${boardId}/members`);
    }

    createBoard(workspaceId: string | null, payload: {
        name: string;
        description?: string | null;
        visibility?: "private" | "workspace" | "public";
        background?: string | null
    }) {
        // Convert the logic to use async/await for consistency
        const inferWorkspaceId = async () => {
            if (workspaceId) return workspaceId;
            if (this.store.boards().length) {
                return this.store.boards()[0]!.workspaceId;
            }
            const workspaces = await this.api.get<{ id: string }[]>('/api/workspaces');
            return workspaces?.[0]?.id;
        };

        return inferWorkspaceId().then(wsId => {
            if (!wsId) throw new Error('No workspace available to create a board');
            return this.api.post<Board>(`/api/workspaces/${wsId}/boards`, payload).then(board => {
                const next = [...this.store.boards(), board];
                this.store.setBoards(next);
                return board;
            });
        });
    }

    // Replace the existing methods in BoardsService with these:

    async searchMembers(boardId: string, query?: string): Promise<BoardMemberLite[]> {
        const params = query?.trim() ? { query: query.trim() } : undefined;

        // Some backends return { members: [...] }, others return [...]
        const resp = await this.api.get<{ members: BoardMemberLite[] } | BoardMemberLite[]>(
            `/api/boards/${boardId}/members`,
            query?.trim() ? { params: { query: query.trim() } } : {}
        );

        return Array.isArray(resp) ? resp : resp.members;
    }

    async addMember(boardId: string, email: string, role: MemberRole) {
        return this.api.post<BoardMemberLite>(`/api/boards/${boardId}/members`, { email, role });
    }

    async updateBoardMemberRole(
        boardId: string,
        userId: string,
        role: MemberRole
    ): Promise<{ ok: true } | BoardMemberLite> {
        const res = await this.api.patch<{ ok: true } | BoardMemberLite>(
            `/api/boards/${boardId}/members/${userId}`,
            { role }
        );

        // If you maintain members in the BoardStore and have a local mutator, uncomment:
        // (this.store.updateBoardMemberRoleLocally as any)?.(boardId, userId, role);

        return res;
    }

    async updateBoardBackground(boardId: string, background: string): Promise<Board> {
        const updated = await this.api.patch<Board>(`/api/boards/${boardId}/background`, { background });

        // Update in store
        const boards = this.store.boards();
        const next = boards.map(b => b.id === boardId ? { ...b, background } : b);
        this.store.setBoards(next);

        return updated;
    }

    async updateBoard(boardId: string, data: Partial<{ name: string; description?: string; visibility?: 'private' | 'workspace' | 'public'; isArchived?: boolean }>): Promise<Board> {
        return this.api.patch<Board>(`/api/boards/${boardId}`, data);
    }

    async exportBoard(boardId: string): Promise<any> {
        return this.api.get(`/api/boards/${boardId}/export`);
    }

    async importBoard(workspaceId: string, payload: any): Promise<Board> {
        return this.api.post<Board>(`/api/boards/import`, { workspaceId, ...payload });
    }
}
