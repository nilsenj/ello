import { Injectable } from '@angular/core';
import { ApiBaseService } from './api-base.service';

export type FulfillmentBoardLite = { id: string; name: string; workspaceId: string };
export type FulfillmentSlaRule = { listId: string; slaHours: number };
export type FulfillmentEntitlement = {
    entitled: boolean;
    status: string | null;
    validUntil: string | null;
};
export type FulfillmentIntegrationSource = 'workspace' | 'board' | 'none';
export type FulfillmentTelegramStatus = {
    configured: boolean;
    chatId: string | null;
    hasBotToken: boolean;
    source?: FulfillmentIntegrationSource;
};
export type FulfillmentWebhookStatus = {
    configured: boolean;
    url: string | null;
    source?: FulfillmentIntegrationSource;
};

@Injectable({ providedIn: 'root' })
export class FulfillmentService {
    constructor(private api: ApiBaseService) { }

    getEntitlement(workspaceId: string): Promise<FulfillmentEntitlement> {
        return this.api.get(`/api/modules/ecommerce-fulfillment/workspaces/${workspaceId}/entitlement`);
    }

    activateEntitlementMock(workspaceId: string): Promise<{ ok: true }> {
        return this.api.post(`/api/modules/ecommerce-fulfillment/workspaces/${workspaceId}/entitlement/mock`, {});
    }

    listBoards(workspaceId: string): Promise<FulfillmentBoardLite[]> {
        return this.api.get(`/api/modules/ecommerce-fulfillment/workspaces/${workspaceId}/boards`).catch(() => []);
    }

    async ensureBoards(workspaceId: string): Promise<FulfillmentBoardLite[]> {
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
        return this.api.post(`/api/modules/ecommerce-fulfillment/bootstrap`, { workspaceId, name });
    }

    createOrder(body: {
        boardId: string;
        orderNumber: string;
        customerName: string;
        customerPhone?: string;
        customerEmail?: string;
        address?: string;
        itemsSummary?: string;
        totalAmount?: number;
        currency?: string;
        paidAt?: string;
        carrier?: string;
        trackingNumber?: string;
        trackingUrl?: string;
        notes?: string;
    }): Promise<{ id: string; listId: string }> {
        return this.api.post(`/api/modules/ecommerce-fulfillment/orders`, body);
    }

    getSlaRules(boardId: string): Promise<{ rules: FulfillmentSlaRule[] }> {
        return this.api.get(`/api/modules/ecommerce-fulfillment/boards/${boardId}/sla`);
    }

    updateSlaRules(boardId: string, rules: FulfillmentSlaRule[]): Promise<{ ok: true }> {
        return this.api.put(`/api/modules/ecommerce-fulfillment/boards/${boardId}/sla`, { rules });
    }

    updateTelegram(workspaceId: string, botToken: string, chatId: string): Promise<{ ok: true }> {
        return this.api.put(`/api/modules/ecommerce-fulfillment/workspaces/${workspaceId}/telegram`, { botToken, chatId });
    }

    getTelegram(workspaceId: string): Promise<FulfillmentTelegramStatus> {
        return this.api.get(`/api/modules/ecommerce-fulfillment/workspaces/${workspaceId}/telegram`);
    }

    updateBoardTelegram(boardId: string, botToken: string, chatId: string): Promise<{ ok: true }> {
        return this.api.put(`/api/modules/ecommerce-fulfillment/boards/${boardId}/telegram`, { botToken, chatId });
    }

    getBoardTelegram(boardId: string): Promise<FulfillmentTelegramStatus> {
        return this.api.get(`/api/modules/ecommerce-fulfillment/boards/${boardId}/telegram`);
    }

    createWebhook(workspaceId: string): Promise<{ url: string; path: string }> {
        return this.api.post(`/api/modules/ecommerce-fulfillment/workspaces/${workspaceId}/webhook`, {});
    }

    getWebhookNotify(workspaceId: string): Promise<FulfillmentWebhookStatus> {
        return this.api.get(`/api/modules/ecommerce-fulfillment/workspaces/${workspaceId}/webhook/notify`);
    }

    updateWebhookNotify(workspaceId: string, url: string): Promise<{ ok: true }> {
        return this.api.put(`/api/modules/ecommerce-fulfillment/workspaces/${workspaceId}/webhook/notify`, { url });
    }

    getBoardWebhookNotify(boardId: string): Promise<FulfillmentWebhookStatus> {
        return this.api.get(`/api/modules/ecommerce-fulfillment/boards/${boardId}/webhook/notify`);
    }

    updateBoardWebhookNotify(boardId: string, url: string): Promise<{ ok: true }> {
        return this.api.put(`/api/modules/ecommerce-fulfillment/boards/${boardId}/webhook/notify`, { url });
    }

    getWeeklyReport(boardId: string, from: string, to: string): Promise<{
        created: number;
        shipped: number;
        delivered: number;
        returned: number;
        overdue: number;
        backlog: number;
        avgFulfillmentHours: number | null;
        daily: {
            created: Array<{ date: string; count: number }>;
            shipped: Array<{ date: string; count: number }>;
        };
    }> {
        return this.api.get(`/api/modules/ecommerce-fulfillment/reports/weekly?boardId=${boardId}&from=${from}&to=${to}`);
    }
}
