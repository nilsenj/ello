import { Injectable } from '@angular/core';
import { ApiBaseService } from './api-base.service';

export type AdminUser = {
    id: string;
    email: string;
    name?: string | null;
    isBanned: boolean;
    bannedAt?: string | null;
    banReason?: string | null;
    isSuperAdmin: boolean;
    createdAt: string;
    workspacesCount: number;
};

export type AdminWorkspace = {
    id: string;
    name: string;
    isPersonal: boolean;
    planKey: string;
    createdAt: string;
    membersCount: number;
    boardsCount: number;
    owners: { email: string; name?: string | null }[];
};

export type AdminTransaction = {
    id: string;
    workspaceId: string;
    workspaceName?: string | null;
    planKey: string;
    provider: string;
    status: string;
    amount: number;
    currency: string;
    orderId?: string | null;
    createdAt: string;
};

@Injectable({ providedIn: 'root' })
export class AdminService {
    constructor(private api: ApiBaseService) {}

    listUsers(query?: { q?: string }) {
        const params: Record<string, string> = {};
        if (query?.q) params.q = query.q;
        return this.api.get<{ users: AdminUser[] }>('/api/admin/users', { params });
    }

    updateUserBan(userId: string, banned: boolean, reason?: string | null) {
        return this.api.patch<{ user: AdminUser }>(`/api/admin/users/${userId}/ban`, {
            banned,
            reason: reason ?? null,
        });
    }

    listWorkspaces(query?: { q?: string }) {
        const params: Record<string, string> = {};
        if (query?.q) params.q = query.q;
        return this.api.get<{ workspaces: AdminWorkspace[] }>('/api/admin/workspaces', { params });
    }

    deleteWorkspace(workspaceId: string) {
        return this.api.delete<{ ok: boolean }>(`/api/admin/workspaces/${workspaceId}`);
    }

    listTransactions(query?: { q?: string }) {
        const params: Record<string, string> = {};
        if (query?.q) params.q = query.q;
        return this.api.get<{ transactions: AdminTransaction[] }>('/api/admin/billing/transactions', { params });
    }
}
