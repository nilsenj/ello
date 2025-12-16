import { TestBed } from '@angular/core/testing';
import { ListsService } from './lists.service';
import { ApiBaseService } from './api-base.service';
import { BoardStore } from '../store/board-store.service';
import { HttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ListsService', () => {
    let service: ListsService;
    let apiSpy: { get: any; post: any; patch: any };
    let storeMock: any;

    beforeEach(() => {
        apiSpy = {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
        };

        storeMock = {
            setLists: vi.fn(),
            lists: vi.fn().mockReturnValue([]),
            renameListLocally: vi.fn(),
            currentBoardId: vi.fn().mockReturnValue('b-1'),
        };

        const httpMock = {};

        TestBed.configureTestingModule({
            providers: [
                ListsService,
                { provide: ApiBaseService, useValue: apiSpy },
                { provide: BoardStore, useValue: storeMock },
                { provide: HttpClient, useValue: httpMock },
            ]
        });
        service = TestBed.inject(ListsService);
    });

    it('should call api.get for loadLists', async () => {
        const mockLists = [{ id: 'l1', title: 'List 1', cards: [] }];
        apiSpy.get.mockResolvedValue(mockLists);

        await service.loadLists('b-1');

        expect(apiSpy.get).toHaveBeenCalledWith('/api/boards/b-1/lists');
        // normalizeList ensures title is set and cards is array
        expect(storeMock.setLists).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ id: 'l1', title: 'List 1' })
        ]));
    });

    it('should call api.post for createList', async () => {
        const mockList = { id: 'l2', title: 'List 2', cards: [] };
        apiSpy.post.mockResolvedValue(mockList);

        await service.createList('List 2');

        expect(apiSpy.post).toHaveBeenCalledWith('/api/boards/b-1/lists', { name: 'List 2' });
        expect(storeMock.setLists).toHaveBeenCalled();
    });

    it('should call api.patch for updateListName', async () => {
        apiSpy.patch.mockResolvedValue({});
        await service.updateListName('l1', 'New Name');
        expect(apiSpy.patch).toHaveBeenCalledWith('/api/lists/l1', { name: 'New Name' });
        expect(storeMock.renameListLocally).toHaveBeenCalledWith('l1', 'New Name');
    });

    it('should call api.post for reorderLists', async () => {
        apiSpy.post.mockResolvedValue({});
        await service.reorderLists(['l1', 'l2']);
        expect(apiSpy.post).toHaveBeenCalledWith('/api/boards/b-1/lists/reorder', { listIds: ['l1', 'l2'] });
    });
});
