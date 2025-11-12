// apps/web/src/app/data/boards.service.ts
import { of, map, switchMap, tap } from 'rxjs';
import { Injectable } from '@angular/core';
import { ApiBaseService } from './api-base.service';
import type { Board } from '../types';
import { BoardStore } from '../store/board-store.service';
import { ListsService } from './lists.service';
import { LabelsService } from "./labels.service";
import { HttpClient } from "@angular/common/http";

@Injectable({providedIn: 'root'})
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
        this.store.setCurrentBoardId(boardId);
        await Promise.all([
            this.listsApi.loadLists(boardId),
            this.labelsApi.loadLabels(boardId),
        ]);
    }

    async getMembers(boardId: string) {
        return this.http.get<{ id:string; name:string; avatar?:string }[]>(`/api/boards/${boardId}/members`).toPromise();
    }

    createBoard(name: string, workspaceId?: string) {
        // If the caller didn’t pass a workspace, try to infer one:
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
                return this.http.post<any>(`/api/workspaces/${wsId}/boards`, { name }).pipe(
                    tap(board => {
                        // minimally merge into store
                        const next = [...this.store.boards(), board];
                        this.store.setBoards?.(next); // or whatever setter you have
                    })
                );
            })
        ).toPromise();
    }
}
