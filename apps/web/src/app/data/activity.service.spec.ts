import { TestBed } from '@angular/core/testing';
import { ActivityService } from './activity.service';
import { ApiBaseService } from './api-base.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ActivityService', () => {
    let service: ActivityService;
    let apiSpy: { get: any };

    beforeEach(() => {
        apiSpy = {
            get: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                ActivityService,
                { provide: ApiBaseService, useValue: apiSpy },
            ]
        });
        service = TestBed.inject(ActivityService);
    });

    it('should call api.get for getBoardActivity with default params', async () => {
        apiSpy.get.mockResolvedValue([]);
        await service.getBoardActivity('board-1');
        expect(apiSpy.get).toHaveBeenCalledWith('/api/boards/board-1/activity?limit=20&offset=0');
    });

    it('should call api.get with custom limit and offset', async () => {
        apiSpy.get.mockResolvedValue([]);
        await service.getBoardActivity('board-1', 50, 10);
        expect(apiSpy.get).toHaveBeenCalledWith('/api/boards/board-1/activity?limit=50&offset=10');
    });

    it('should return activities from api response', async () => {
        const mockActivities = [
            { id: 'a1', type: 'create_card', createdAt: '2025-01-01' },
            { id: 'a2', type: 'move_card', createdAt: '2025-01-02' }
        ];
        apiSpy.get.mockResolvedValue(mockActivities);

        const result = await service.getBoardActivity('board-1');
        expect(result).toEqual(mockActivities);
    });
});
