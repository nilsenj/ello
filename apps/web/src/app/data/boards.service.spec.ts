import { TestBed } from '@angular/core/testing';
import { BoardsService } from './boards.service';
import { ApiBaseService } from './api-base.service';
import { BoardStore } from '../store/board-store.service';
import { ListsService } from './lists.service';
import { LabelsService } from './labels.service';
import { HttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('BoardsService', () => {
    let service: BoardsService;
    let apiSpy: { get: any; post: any; patch: any };
    let storeMock: any;

    beforeEach(() => {
        apiSpy = {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
        };

        storeMock = {
            setBoards: vi.fn(),
            setCurrentBoardId: vi.fn(),
            setMembers: vi.fn(),
            boards: vi.fn().mockReturnValue([]),
        };

        const listsMock = { loadLists: vi.fn().mockResolvedValue([]) };
        const labelsMock = { loadLabels: vi.fn().mockResolvedValue([]) };
        const httpMock = {};

        TestBed.configureTestingModule({
            providers: [
                BoardsService,
                { provide: ApiBaseService, useValue: apiSpy },
                { provide: BoardStore, useValue: storeMock },
                { provide: ListsService, useValue: listsMock },
                { provide: LabelsService, useValue: labelsMock },
                { provide: HttpClient, useValue: httpMock },
            ]
        });
        service = TestBed.inject(BoardsService);
    });

    it('should call api.get for loading boards', async () => {
        apiSpy.get.mockResolvedValue([]);
        await service.loadBoards();
        expect(apiSpy.get).toHaveBeenCalledWith('/api/boards');
        expect(storeMock.setBoards).toHaveBeenCalledWith([]);
    });

    it('should infer workspace and call api.post for createBoard', async () => {
        // Mock existing boards to infer workspaceId
        storeMock.boards.mockReturnValue([{ workspaceId: 'ws-1' }]);
        apiSpy.post.mockResolvedValue({ id: 'b-1', workspaceId: 'ws-1' });

        await service.createBoard(null, { name: 'New Board' });

        expect(apiSpy.post).toHaveBeenCalledWith('/api/workspaces/ws-1/boards', expect.objectContaining({ name: 'New Board' }));
    });

    it('should call api.get with params for searchMembers', async () => {
        apiSpy.get.mockResolvedValue([]);
        await service.searchMembers('b-1', 'query');

        expect(apiSpy.get).toHaveBeenCalledWith('/api/boards/b-1/members', { params: { query: 'query' } });
    });
});
