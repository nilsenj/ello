// apps/web/src/app/data/boards.service.ts
import { of, map, switchMap, tap, firstValueFrom } from 'rxjs';
import { Injectable } from '@angular/core';
import { ApiBaseService } from './api-base.service';
import type { Board } from '../types';
import { BoardStore } from '../store/board-store.service';
import { ListsService } from './lists.service';
import { LabelsService } from "./labels.service";
import { HttpClient } from "@angular/common/http";

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type BoardMemberLite = { id: string; name: string; avatar?: string; role: MemberRole };
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

        const loadAll = () => Promise.all([
            this.listsApi.loadLists(boardId),
            this.labelsApi.loadLabels(boardId),
        ]);

        try {
            await loadAll();
        } catch (err: any) {
            const status = err?.status ?? err?.statusCode ?? err?.error?.statusCode;
            if (status === 403) {
                // Not a member yet → join and retry
                await firstValueFrom(this.http.post(`/api/boards/${boardId}/join`, {}));
                await loadAll();
            } else {
                throw err;
            }
        }
    }

    async getMembers(boardId: string) {
        return this.http.get<{ id: string; name: string; avatar?: string }[]>(`/api/boards/${boardId}/members`).toPromise();
    }

    createBoard(workspaceId: string | null, payload: {
        name: string;
        description?: string | null;
        visibility?: "private" | "workspace" | "public";
        background?: string | null
    }) {        // If the caller didn’t pass a workspace, try to infer one:
        // 1) from already-loaded boards, or
        // 2) fetch the first workspace from API (fallback).
        const inferWorkspaceId$ = workspaceId
            ? of(workspaceId)
            : (this.store.boards().length
                ? of(this.store.boards()[0]!.workspaceId) // adjust if your Board type stores it differently
                : this.http.get<{ id: string }[]>('/api/workspaces').pipe(
                    map(ws => ws?.[0]?.id),
                )
            );

        return inferWorkspaceId$.pipe(
            switchMap(wsId => {
                if (!wsId) throw new Error('No workspace available to create a board');
                return this.http.post<any>(`/api/workspaces/${wsId}/boards`, { ...payload }).pipe(
                    tap(board => {
                        // minimally merge into store
                        const next = [...this.store.boards(), board];
                        this.store.setBoards?.(next); // or whatever setter you have
                    })
                );
            })
        ).toPromise();
    }

    // Replace the existing methods in BoardsService with these:

    async searchMembers(boardId: string, query?: string): Promise<BoardMemberLite[]> {
        const params = query?.trim() ? { query: query.trim() } : undefined;

        // Some backends return { members: [...] }, others return [...]
        const resp = await firstValueFrom(
            this.http.get<{ members: BoardMemberLite[] } | BoardMemberLite[]>(
                `/api/boards/${boardId}/members`,
                { params }
            )
        );

        return Array.isArray(resp) ? resp : resp.members;
    }

    async addMember(boardId: string, email: string, role: MemberRole) {
        return firstValueFrom(
            this.http.post<BoardMemberLite>(`/api/boards/${boardId}/members`, { email, role })
        );
    }

    async updateBoardMemberRole(
        boardId: string,
        userId: string,
        role: MemberRole
    ): Promise<{ ok: true } | BoardMemberLite> {
        const res = await firstValueFrom(
            this.http.patch<{ ok: true } | BoardMemberLite>(
                `/api/boards/${boardId}/members/${userId}`,
                { role }
            )
        );

        // If you maintain members in the BoardStore and have a local mutator, uncomment:
        // (this.store.updateBoardMemberRoleLocally as any)?.(boardId, userId, role);

        return res;
    }

    async updateBoardBackground(boardId: string, background: string): Promise<Board> {
        const updated = await firstValueFrom(
            this.http.patch<Board>(`/api/boards/${boardId}/background`, { background })
        );

        // Update in store
        const boards = this.store.boards();
        const next = boards.map(b => b.id === boardId ? { ...b, background } : b);
        this.store.setBoards(next);

        return updated;
    }

    async updateBoard(boardId: string, data: Partial<{ name: string; description?: string; visibility?: 'private' | 'workspace' | 'public'; isArchived?: boolean }>): Promise<Board> {
        return firstValueFrom(
            this.http.patch<Board>(`/api/boards/${boardId}`, data)
        );
    }
}
