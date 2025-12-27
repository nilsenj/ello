// apps/web/src/app/data/workspaces.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiBaseService } from './api-base.service';

/** Minimal workspace shape for pickers/menus */
export type WorkspaceLite = {
    id: string;
    name: string;
    description?: string;
    isPersonal?: boolean;
    whoCanCreateBoards?: 'admins' | 'members';
    whoCanInviteMembers?: 'admins' | 'members';
    role?: 'owner' | 'admin' | 'member' | 'viewer';
};

/** Server returns { members: WorkspaceMember[] } from GET /workspaces/:id/members */
export type WorkspaceMember = {
    id: string;                 // userId
    name: string;               // display name (or email fallback)
    email?: string;             // optional if you later expose it
    avatar?: string;            // optional
    role: 'owner' | 'admin' | 'member' | 'viewer';
    status?: 'active' | 'pending';
};

export type CreateBoardBody = {
    name: string;
    description?: string;
    background?: string;
    lists?: string[];
    labels?: { name: string; color: string }[];
    cards?: {
        title: string;
        description?: string | null;
        list: string;
        checklists?: { title: string; items: string[] }[];
        labelNames?: string[];
    }[];
};

export type CreatedBoard = {
    id: string;
    name: string;
    description?: string | null;
    workspaceId: string;
};

export type WorkspaceSettings = {
    id: string;
    name: string;
    description?: string | null;
    visibility: 'private' | 'public';
    whoCanCreateBoards: 'admins' | 'members';
    whoCanInviteMembers: 'admins' | 'members';
    allowedEmailDomains?: string | null;
    defaultBoardVisibility: 'private' | 'workspace' | 'public';
};

export type WorkspaceSettingsUpdate = {
    visibility?: 'private' | 'public';
    whoCanCreateBoards?: 'admins' | 'members';
    whoCanInviteMembers?: 'admins' | 'members';
    allowedEmailDomains?: string | null;
    defaultBoardVisibility?: 'private' | 'workspace' | 'public';
};

@Injectable({ providedIn: 'root' })
export class WorkspacesService {
    constructor(
        private api: ApiBaseService,
        private http: HttpClient
    ) { }

    /** GET /api/workspaces → list of { id, name } */
    async list(): Promise<WorkspaceLite[]> {
        return this.api.get<WorkspaceLite[]>('/api/workspaces');
    }

    /** POST /api/workspaces */
    async create(body: { name: string; description?: string; isPersonal?: boolean }): Promise<WorkspaceLite> {
        return this.api.post<WorkspaceLite>('/api/workspaces', body);
    }

    /** PUT /api/workspaces/:id */
    async update(id: string, body: { name?: string; description?: string }): Promise<WorkspaceLite> {
        return this.api.put<WorkspaceLite>(`/api/workspaces/${id}`, body);
    }

    /** DELETE /api/workspaces/:id */
    async delete(id: string): Promise<void> {
        return this.api.delete<void>(`/api/workspaces/${id}`);
    }

    /** POST /api/workspaces/:id/members */
    async addMember(id: string, email: string, role: 'owner' | 'admin' | 'member' | 'viewer' = 'member'): Promise<WorkspaceMember> {
        return this.api.post<WorkspaceMember>(`/api/workspaces/${id}/members`, { email, role });
    }

    async removeMember(workspaceId: string, memberId: string): Promise<void> {
        return this.api.delete<void>(`/api/workspaces/${workspaceId}/members/${memberId}`);
    }

    /** POST /api/workspaces/:workspaceId/boards → create a board inside a workspace */
    async createBoard(workspaceId: string, body: CreateBoardBody): Promise<CreatedBoard> {
        if (!workspaceId) throw new Error('workspaceId is required');
        if (!body?.name?.trim()) throw new Error('Board name is required');
        return this.api.post<CreatedBoard>(`/api/workspaces/${workspaceId}/boards`, body);
    }

    /**
     * GET /workspaces/:workspaceId/members?query=...
     * Server responds { members: WorkspaceMember[] }
     */
    async searchMembers(workspaceId: string, query = ''): Promise<WorkspaceMember[]> {
        if (!workspaceId) throw new Error('workspaceId is required');
        const res = await this.api.get<{ members: WorkspaceMember[] }>(
            `/api/workspaces/${workspaceId}/members` + (query ? `?query=${query}` : '')
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
        await this.api.patch<void>(`/api/workspaces/${workspaceId}/members/${userId}`, { role });
    }

    /**
     * GET /workspaces/:workspaceId/boards
     * Get all boards in a workspace
     */
    async getBoardsInWorkspace(workspaceId: string): Promise<any[]> {
        if (!workspaceId) throw new Error('workspaceId is required');
        return this.api.get<any[]>(`/api/workspaces/${workspaceId}/boards`);
    }

    /**
     * GET /workspaces/:id/settings
     * Get workspace settings (visibility, permissions, etc.)
     */
    async getSettings(id: string): Promise<WorkspaceSettings> {
        if (!id) throw new Error('workspaceId is required');
        return this.api.get<WorkspaceSettings>(`/api/workspaces/${id}/settings`);
    }

    /**
     * PATCH /workspaces/:id/settings
     * Update workspace settings (admins only)
     */
    async updateSettings(id: string, settings: WorkspaceSettingsUpdate): Promise<WorkspaceSettings> {
        if (!id) throw new Error('workspaceId is required');
        return this.api.patch<WorkspaceSettings>(`/api/workspaces/${id}/settings`, settings);
    }

}
