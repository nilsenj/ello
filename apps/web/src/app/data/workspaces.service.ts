// apps/web/src/app/data/workspaces.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiBaseService } from './api-base.service';

/** Minimal workspace shape for pickers/menus */
export type WorkspaceLite = { id: string; name: string };

/** Server returns { members: WorkspaceMember[] } from GET /workspaces/:id/members */
export type WorkspaceMember = {
    id: string;                 // userId
    name: string;               // display name (or email fallback)
    email?: string;             // optional if you later expose it
    avatar?: string;            // optional
    role: 'owner' | 'admin' | 'member' | 'viewer';
};

export type CreateBoardBody = {
    name: string;
    description?: string;
};

export type CreatedBoard = {
    id: string;
    name: string;
    description?: string | null;
    workspaceId: string;
};

@Injectable({ providedIn: 'root' })
export class WorkspacesService {
    constructor(
        private api: ApiBaseService,
        private http: HttpClient
    ) {}

    /** GET /api/workspaces → list of { id, name } */
    async list(): Promise<WorkspaceLite[]> {
        return firstValueFrom(this.http.get<WorkspaceLite[]>('/api/workspaces'));
    }

    /** POST /api/workspaces/:workspaceId/boards → create a board inside a workspace */
    async createBoard(workspaceId: string, body: CreateBoardBody): Promise<CreatedBoard> {
        if (!workspaceId) throw new Error('workspaceId is required');
        if (!body?.name?.trim()) throw new Error('Board name is required');
        return firstValueFrom(
            this.http.post<CreatedBoard>(`/api/workspaces/${workspaceId}/boards`, body)
        );
    }

    /**
     * GET /workspaces/:workspaceId/members?query=...
     * Server responds { members: WorkspaceMember[] }
     */
    async searchMembers(workspaceId: string, query = ''): Promise<WorkspaceMember[]> {
        if (!workspaceId) throw new Error('workspaceId is required');
        const res = await firstValueFrom(
            this.http.get<{ members: WorkspaceMember[] }>(
                `/api/workspaces/${workspaceId}/members`,
                { params: query ? { query } : {} }
            )
        );
        return res.members ?? [];
    }

    /**
     * PATCH /workspaces/:workspaceId/members/:userId  { role }
     * Updates permission role on the workspace (owner/admin/member/viewer)
     */
    async setMemberRole(
        workspaceId: string,
        userId: string,
        role: WorkspaceMember['role']
    ): Promise<void> {
        if (!workspaceId) throw new Error('workspaceId is required');
        if (!userId) throw new Error('userId is required');
        await firstValueFrom(
            this.http.patch<void>(`/api/workspaces/${workspaceId}/members/${userId}`, { role })
        );
    }

}