import { TestBed } from '@angular/core/testing';
import { LabelsService } from './labels.service';
import { ApiBaseService } from './api-base.service';
import { BoardStore } from '../store/board-store.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('LabelsService', () => {
    let service: LabelsService;
    let apiSpy: { get: any; post: any; patch: any; delete: any };
    let storeMock: any;

    beforeEach(() => {
        apiSpy = {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
        };

        storeMock = {
            labels: vi.fn().mockReturnValue([]),
            setLabels: vi.fn(),
            addLabelToCard: vi.fn(),
            removeLabelFromCard: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                LabelsService,
                { provide: ApiBaseService, useValue: apiSpy },
                { provide: BoardStore, useValue: storeMock },
            ]
        });
        service = TestBed.inject(LabelsService);
    });

    it('should call api.get and setLabels for loadLabels', async () => {
        const mockLabels = [{ id: 'l1', name: 'Bug', color: '#ff0000' }];
        apiSpy.get.mockResolvedValue(mockLabels);

        await service.loadLabels('board-1');

        expect(apiSpy.get).toHaveBeenCalledWith('/api/boards/board-1/labels');
        expect(storeMock.setLabels).toHaveBeenCalledWith(mockLabels);
    });

    it('should handle errors gracefully in loadLabels', async () => {
        apiSpy.get.mockRejectedValue(new Error('Network error'));

        await service.loadLabels('board-1');

        expect(storeMock.setLabels).toHaveBeenCalledWith([]);
    });

    it('should call api.post and update store for createLabel', async () => {
        const newLabel = { id: 'l2', name: 'Feature', color: '#00ff00' };
        apiSpy.post.mockResolvedValue(newLabel);
        storeMock.labels.mockReturnValue([{ id: 'l1', name: 'Bug', color: '#ff0000' }]);

        await service.createLabel('board-1', { name: 'Feature', color: '#00ff00' });

        expect(apiSpy.post).toHaveBeenCalledWith('/api/boards/board-1/labels', { name: 'Feature', color: '#00ff00' });
        expect(storeMock.setLabels).toHaveBeenCalled();
    });

    it('should call api.patch and update store for renameLabel', async () => {
        const updated = { id: 'l1', name: 'Updated', color: '#ff0000' };
        apiSpy.patch.mockResolvedValue(updated);
        storeMock.labels.mockReturnValue([{ id: 'l1', name: 'Bug', color: '#ff0000' }]);

        await service.renameLabel('l1', { name: 'Updated' });

        expect(apiSpy.patch).toHaveBeenCalledWith('/api/labels/l1', { name: 'Updated' });
        expect(storeMock.setLabels).toHaveBeenCalled();
    });

    it('should call api.delete and update store for deleteLabel', async () => {
        apiSpy.delete.mockResolvedValue(undefined);
        storeMock.labels.mockReturnValue([
            { id: 'l1', name: 'Bug', color: '#ff0000' },
            { id: 'l2', name: 'Feature', color: '#00ff00' }
        ]);

        await service.deleteLabel('l1');

        expect(apiSpy.delete).toHaveBeenCalledWith('/api/labels/l1');
        expect(storeMock.setLabels).toHaveBeenCalledWith([{ id: 'l2', name: 'Feature', color: '#00ff00' }]);
    });

    it('should call api.post and update store for assignToCard', async () => {
        apiSpy.post.mockResolvedValue({});

        await service.assignToCard('card-1', 'label-1');

        expect(apiSpy.post).toHaveBeenCalledWith('/api/cards/card-1/labels', { labelId: 'label-1' });
        expect(storeMock.addLabelToCard).toHaveBeenCalledWith('card-1', 'label-1');
    });

    it('should call api.delete and update store for unassignFromCard', async () => {
        apiSpy.delete.mockResolvedValue({});

        await service.unassignFromCard('card-1', 'label-1');

        expect(apiSpy.delete).toHaveBeenCalledWith('/api/cards/card-1/labels/label-1');
        expect(storeMock.removeLabelFromCard).toHaveBeenCalledWith('card-1', 'label-1');
    });
});
