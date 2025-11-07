// apps/web/src/app/data/boards.service.ts
import {Injectable} from '@angular/core';
import {ApiBaseService} from './api-base.service';
import type {Board} from '../types';
import {BoardStore} from '../store/board-store.service';
import {ListsService} from './lists.service';
import {LabelsService} from "./labels.service";

@Injectable({providedIn: 'root'})
export class BoardsService {
    constructor(
        private api: ApiBaseService,
        private store: BoardStore,
        private listsApi: ListsService,
        private labelsApi: LabelsService,
    ) {
    }

    async loadBoards() {
        const boards = await this.api.get<Board[]>('/api/boards').catch(() => []);
        this.store.setBoards(boards ?? []);
        if (boards?.length) await this.selectBoard(boards[0].id);
    }

    async selectBoard(boardId: string) {
        this.store.setCurrentBoardId(boardId);
        await Promise.all([
            this.listsApi.loadLists(boardId),
            this.labelsApi.loadLabels(boardId),
        ]);
    }
}
