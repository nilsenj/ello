import { Injectable } from '@angular/core';
import { ApiBaseService } from './api-base.service';

export type ServiceDeskBoardLite = { id: string; name: string; workspaceId: string };
export type ServiceDeskSlaRule = { listId: string; slaHours: number };
export type ServiceDeskEntitlement = {
    entitled: boolean;
    status: string | null;
    validUntil: string | null;
};
export type ServiceDeskIntegrationSource = 'workspace' | 'board' | 'none';
export type ServiceDeskTelegramStatus = {
    configured: boolean;
    chatId: string | null;
    hasBotToken: boolean;
    source?: ServiceDeskIntegrationSource;
};
export type ServiceDeskWebhookStatus = {
    configured: boolean;
    url: string | null;
    source?: ServiceDeskIntegrationSource;
};

@Injectable({ providedIn: 'root' })
export class ServiceDeskService {
    constructor(private api: ApiBaseService) { }

    getEntitlement(workspaceId: string): Promise<ServiceDeskEntitlement> {
        return this.api.get(`/api/modules/service-desk/workspaces/${workspaceId}/entitlement`);
    }

    activateEntitlementMock(workspaceId: string): Promise<{ ok: true }> {
        return this.api.post(`/api/modules/service-desk/workspaces/${workspaceId}/entitlement/mock`, {});
    }

    listBoards(workspaceId: string): Promise<ServiceDeskBoardLite[]> {
        return this.api.get(`/api/modules/service-desk/workspaces/${workspaceId}/boards`).catch(() => []);
    }

    async ensureBoards(workspaceId: string): Promise<ServiceDeskBoardLite[]> {
        const boards = await this.listBoards(workspaceId);
        if (boards.length) return boards;
        try {
            await this.bootstrap(workspaceId);
        } catch {
            return boards;
        }
        return this.listBoards(workspaceId);
    }

    bootstrap(workspaceId: string, name?: string): Promise<{ boardId: string }> {
        return this.api.post(`/api/modules/service-desk/bootstrap`, { workspaceId, name });
    }

    createRequest(body: {
        boardId: string;
        customerName: string;
        customerPhone: string;
        address?: string;
        serviceType?: string;
        notes?: string;
        scheduledAt?: string;
    }): Promise<{ id: string; listId: string }> {
        return this.api.post(`/api/modules/service-desk/requests`, body);
    }

    getSlaRules(boardId: string): Promise<{ rules: ServiceDeskSlaRule[] }> {
        return this.api.get(`/api/modules/service-desk/boards/${boardId}/sla`);
    }

    updateSlaRules(boardId: string, rules: ServiceDeskSlaRule[]): Promise<{ ok: true }> {
        return this.api.put(`/api/modules/service-desk/boards/${boardId}/sla`, { rules });
    }

    updateTelegram(workspaceId: string, botToken: string, chatId: string): Promise<{ ok: true }> {
        return this.api.put(`/api/modules/service-desk/workspaces/${workspaceId}/telegram`, { botToken, chatId });
    }

    getTelegram(workspaceId: string): Promise<ServiceDeskTelegramStatus> {
        return this.api.get(`/api/modules/service-desk/workspaces/${workspaceId}/telegram`);
    }

    updateBoardTelegram(boardId: string, botToken: string, chatId: string): Promise<{ ok: true }> {
        return this.api.put(`/api/modules/service-desk/boards/${boardId}/telegram`, { botToken, chatId });
    }

    getBoardTelegram(boardId: string): Promise<ServiceDeskTelegramStatus> {
        return this.api.get(`/api/modules/service-desk/boards/${boardId}/telegram`);
    }

    createWebhook(workspaceId: string): Promise<{ url: string; path: string }> {
        return this.api.post(`/api/modules/service-desk/workspaces/${workspaceId}/webhook`, {});
    }

    getWebhookNotify(workspaceId: string): Promise<ServiceDeskWebhookStatus> {
        return this.api.get(`/api/modules/service-desk/workspaces/${workspaceId}/webhook/notify`);
    }

    updateWebhookNotify(workspaceId: string, url: string): Promise<{ ok: true }> {
        return this.api.put(`/api/modules/service-desk/workspaces/${workspaceId}/webhook/notify`, { url });
    }

    getBoardWebhookNotify(boardId: string): Promise<ServiceDeskWebhookStatus> {
        return this.api.get(`/api/modules/service-desk/boards/${boardId}/webhook/notify`);
    }

    updateBoardWebhookNotify(boardId: string, url: string): Promise<{ ok: true }> {
        return this.api.put(`/api/modules/service-desk/boards/${boardId}/webhook/notify`, { url });
    }

    getWeeklyReport(boardId: string, from: string, to: string): Promise<{
        created: number;
        closed: number;
        overdue: number;
        backlog: number;
        avgResolutionHours: number | null;
        daily: {
            created: Array<{ date: string; count: number }>;
            closed: Array<{ date: string; count: number }>;
        };
    }> {
        return this.api.get(`/api/modules/service-desk/reports/weekly?boardId=${boardId}&from=${from}&to=${to}`);
    }
}
