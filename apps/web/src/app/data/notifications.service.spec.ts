import { TestBed } from '@angular/core/testing';
import { NotificationsService } from './notifications.service';
import { ApiBaseService } from './api-base.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';

describe('NotificationsService', () => {
    let service: NotificationsService;
    let apiSpy: { get: any; patch: any; delete: any };

    beforeEach(() => {
        // Mock localStorage
        vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('mock-token');

        apiSpy = {
            get: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                NotificationsService,
                { provide: ApiBaseService, useValue: apiSpy },
            ]
        });
        service = TestBed.inject(NotificationsService);
    });

    it('should call api.get for getNotifications with default params', async () => {
        const mockNotifications = [{ id: 'n1', title: 'Test', isRead: false }];
        apiSpy.get.mockResolvedValue(mockNotifications);

        const result = await firstValueFrom(service.getNotifications());

        expect(apiSpy.get).toHaveBeenCalledWith('/api/notifications?limit=20&offset=0', expect.any(Object));
        expect(result).toEqual(mockNotifications);
    });

    it('should call api.get with custom limit and offset', async () => {
        apiSpy.get.mockResolvedValue([]);

        await firstValueFrom(service.getNotifications(50, 10));

        expect(apiSpy.get).toHaveBeenCalledWith('/api/notifications?limit=50&offset=10', expect.any(Object));
    });

    it('should call api.get for getUnreadCount', async () => {
        apiSpy.get.mockResolvedValue({ count: 5 });

        const result = await firstValueFrom(service.getUnreadCount());

        expect(apiSpy.get).toHaveBeenCalledWith('/api/notifications/unread/count', expect.any(Object));
        expect(result).toEqual({ count: 5 });
    });

    it('should call api.patch for markAsRead', async () => {
        const mockNotification = { id: 'n1', title: 'Test', isRead: true };
        apiSpy.patch.mockResolvedValue(mockNotification);

        const result = await firstValueFrom(service.markAsRead('n1'));

        expect(apiSpy.patch).toHaveBeenCalledWith('/api/notifications/n1/read', {}, expect.any(Object));
        expect(result).toEqual(mockNotification);
    });

    it('should call api.patch for markAllAsRead', async () => {
        apiSpy.patch.mockResolvedValue({ ok: true });

        const result = await firstValueFrom(service.markAllAsRead());

        expect(apiSpy.patch).toHaveBeenCalledWith('/api/notifications/read-all', {}, expect.any(Object));
        expect(result).toEqual({ ok: true });
    });

    it('should call api.delete for deleteNotification', async () => {
        apiSpy.delete.mockResolvedValue({ ok: true });

        const result = await firstValueFrom(service.deleteNotification('n1'));

        expect(apiSpy.delete).toHaveBeenCalledWith('/api/notifications/n1', expect.any(Object));
        expect(result).toEqual({ ok: true });
    });
});
