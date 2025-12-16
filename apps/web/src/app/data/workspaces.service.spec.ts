import { TestBed } from '@angular/core/testing';
import { WorkspacesService } from './workspaces.service';
import { ApiBaseService } from './api-base.service';
import { HttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WorkspacesService', () => {
    let service: WorkspacesService;
    let apiSpy: { get: any; post: any; put: any; delete: any; patch: any };

    beforeEach(() => {
        apiSpy = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            patch: vi.fn(),
        };

        const httpClientMock = {
            get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                WorkspacesService,
                { provide: ApiBaseService, useValue: apiSpy },
                { provide: HttpClient, useValue: httpClientMock },
            ]
        });
        service = TestBed.inject(WorkspacesService);
    });

    it('should call api.get for listing workspaces', async () => {
        apiSpy.get.mockResolvedValue([]);
        await service.list();
        expect(apiSpy.get).toHaveBeenCalledWith('/api/workspaces');
    });

    it('should call api.post for creating workspace', async () => {
        apiSpy.post.mockResolvedValue({ id: '1', name: 'WS' });
        await service.create({ name: 'WS' });
        expect(apiSpy.post).toHaveBeenCalledWith('/api/workspaces', { name: 'WS' });
    });

    it('should call api.put for updating workspace', async () => {
        apiSpy.put.mockResolvedValue({ id: '1', name: 'Updated' });
        await service.update('1', { name: 'Updated' });
        expect(apiSpy.put).toHaveBeenCalledWith('/api/workspaces/1', { name: 'Updated' });
    });

    it('should call api.delete for deleting workspace', async () => {
        apiSpy.delete.mockResolvedValue(undefined);
        await service.delete('1');
        expect(apiSpy.delete).toHaveBeenCalledWith('/api/workspaces/1');
    });

    it('should call api.post for adding member', async () => {
        apiSpy.post.mockResolvedValue({});
        await service.addMember('1', 'test@test.com', 'admin');
        expect(apiSpy.post).toHaveBeenCalledWith('/api/workspaces/1/members', { email: 'test@test.com', role: 'admin' });
    });
});
