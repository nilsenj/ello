import { TestBed } from '@angular/core/testing';
import { CardsService } from './cards.service';
import { ApiBaseService } from './api-base.service';
import { ListsService } from './lists.service';
import { BoardStore } from '../store/board-store.service';
import { HttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CardsService', () => {
    let service: CardsService;
    let apiSpy: { get: any; post: any; patch: any; delete: any };
    let storeMock: any;
    let listsSvcMock: any;

    beforeEach(() => {
        apiSpy = {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
        };

        storeMock = {
            upsertCardLocally: vi.fn(),
            lists: vi.fn().mockReturnValue([]),
            setLists: vi.fn(),
            patchCardTitleLocally: vi.fn(),
            removeCardLocally: vi.fn(),
            addLabelToCardLocally: vi.fn(),
            removeLabelFromCardLocally: vi.fn(),
        };

        listsSvcMock = {};
        const httpMock = {};

        TestBed.configureTestingModule({
            providers: [
                CardsService,
                { provide: ApiBaseService, useValue: apiSpy },
                { provide: ListsService, useValue: listsSvcMock },
                { provide: BoardStore, useValue: storeMock },
                { provide: HttpClient, useValue: httpMock },
            ]
        });
        service = TestBed.inject(CardsService);
    });

    it('should call api.post for createCard', async () => {
        const mockCard = { id: 'c1', title: 'New Card' };
        apiSpy.post.mockResolvedValue(mockCard);

        const res = await service.createCard('l1', 'New Card');

        expect(apiSpy.post).toHaveBeenCalledWith('/api/lists/l1/cards', { title: 'New Card' });
        expect(storeMock.upsertCardLocally).toHaveBeenCalledWith('l1', mockCard);
        expect(res).toEqual(mockCard);
    });

    it('should call api.post for moveCard', async () => {
        apiSpy.post.mockResolvedValue({});
        storeMock.lists.mockReturnValue([{ id: 'l1', cards: [] }, { id: 'l2', cards: [] }]);

        await service.moveCard('c1', 'l2', 'before-id', null);

        expect(apiSpy.post).toHaveBeenCalledWith('/api/cards/c1/move', {
            toListId: 'l2',
            beforeId: 'before-id',
            afterId: null
        });
    });

    it('should call api.patch for updateCard', async () => {
        apiSpy.patch.mockResolvedValue({});
        await service.updateCard('c1', { title: 'Updated' });
        expect(apiSpy.patch).toHaveBeenCalledWith('/api/cards/c1', { title: 'Updated' });
        expect(storeMock.patchCardTitleLocally).toHaveBeenCalledWith('c1', 'Updated');
    });

    it('should call api.delete for deleteCard', async () => {
        apiSpy.delete.mockResolvedValue({});
        await service.deleteCard('c1');
        expect(apiSpy.delete).toHaveBeenCalledWith('/api/cards/c1');
        expect(storeMock.removeCardLocally).toHaveBeenCalledWith('c1');
    });

    it('should call api.post for addLabel', async () => {
        apiSpy.post.mockResolvedValue({});
        await service.addLabel('c1', 'label-1');
        expect(apiSpy.post).toHaveBeenCalledWith('/api/cards/c1/labels', { labelId: 'label-1' });
    });
});
