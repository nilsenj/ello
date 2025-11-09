// apps/web/src/app/data/boards.service.ts
import {Injectable} from '@angular/core';
import {ApiBaseService} from './api-base.service';
import type {Board} from '../types';
import {BoardStore} from '../store/board-store.service';
import {ListsService} from './lists.service';
import {LabelsService} from "./labels.service";
import {HttpClient} from "@angular/common/http";

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
}
