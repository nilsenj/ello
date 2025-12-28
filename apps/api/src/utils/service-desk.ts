import type { PrismaClient } from '@prisma/client';

export const SERVICE_DESK_MODULE_KEY = 'service_desk';
export const SERVICE_DESK_STATUS_KEYS = [
    'inbox',
    'scheduled',
    'in_progress',
    'waiting_client',
    'done',
    'canceled',
] as const;

export type ServiceDeskStatusKey = typeof SERVICE_DESK_STATUS_KEYS[number];

export const SERVICE_DESK_LIST_DEFS: Array<{ key: ServiceDeskStatusKey; name: string }> = [
    { key: 'inbox', name: 'Inbox' },
    { key: 'scheduled', name: 'Scheduled' },
    { key: 'in_progress', name: 'In Progress' },
    { key: 'waiting_client', name: 'Waiting Client' },
    { key: 'done', name: 'Done' },
    { key: 'canceled', name: 'Canceled' },
];

export async function isWorkspaceEntitled(prisma: PrismaClient, workspaceId: string) {
    const client = prisma as PrismaClient & { workspaceEntitlement?: { findUnique: Function } };
    if (!client.workspaceEntitlement?.findUnique) return false;
    const now = new Date();
    const row = await client.workspaceEntitlement.findUnique({
        where: { workspaceId_moduleKey: { workspaceId, moduleKey: SERVICE_DESK_MODULE_KEY } },
        select: { status: true, validUntil: true },
    });
    if (!row) return false;
    if (row.status !== 'active') return false;
    if (row.validUntil && row.validUntil < now) return false;
    return true;
}

export type ServiceDeskIntegrationSource = 'board' | 'workspace';

export async function getServiceDeskTelegramIntegration(
    prisma: PrismaClient,
    boardId: string,
    workspaceId: string,
): Promise<{ botTokenEncrypted: string; chatId: string; source: ServiceDeskIntegrationSource } | null> {
    const boardClient = (prisma as any).boardIntegration;
    if (boardClient?.findUnique) {
        const boardIntegration = await boardClient.findUnique({
            where: { boardId_type: { boardId, type: 'telegram' } },
            select: { botTokenEncrypted: true, chatId: true },
        });
        if (boardIntegration?.botTokenEncrypted && boardIntegration?.chatId) {
            return {
                botTokenEncrypted: boardIntegration.botTokenEncrypted,
                chatId: boardIntegration.chatId,
                source: 'board',
            };
        }
    }

    const workspaceClient = (prisma as any).workspaceIntegration;
    if (!workspaceClient?.findUnique) return null;
    const workspaceIntegration = await workspaceClient.findUnique({
        where: { workspaceId_type: { workspaceId, type: 'telegram' } },
        select: { botTokenEncrypted: true, chatId: true },
    });
    if (workspaceIntegration?.botTokenEncrypted && workspaceIntegration?.chatId) {
        return {
            botTokenEncrypted: workspaceIntegration.botTokenEncrypted,
            chatId: workspaceIntegration.chatId,
            source: 'workspace',
        };
    }
    return null;
}

export async function getServiceDeskWebhookNotifyIntegration(
    prisma: PrismaClient,
    boardId: string,
    workspaceId: string,
): Promise<{ webhookNotifyUrlEncrypted: string; source: ServiceDeskIntegrationSource } | null> {
    const boardClient = (prisma as any).boardIntegration;
    if (boardClient?.findUnique) {
        const boardIntegration = await boardClient.findUnique({
            where: { boardId_type: { boardId, type: 'webhook' } },
            select: { webhookNotifyUrlEncrypted: true },
        });
        if (boardIntegration?.webhookNotifyUrlEncrypted) {
            return {
                webhookNotifyUrlEncrypted: boardIntegration.webhookNotifyUrlEncrypted,
                source: 'board',
            };
        }
    }

    const workspaceClient = (prisma as any).workspaceIntegration;
    if (!workspaceClient?.findUnique) return null;
    const workspaceIntegration = await workspaceClient.findUnique({
        where: { workspaceId_type: { workspaceId, type: 'webhook' } },
        select: { webhookNotifyUrlEncrypted: true },
    });
    if (workspaceIntegration?.webhookNotifyUrlEncrypted) {
        return {
            webhookNotifyUrlEncrypted: workspaceIntegration.webhookNotifyUrlEncrypted,
            source: 'workspace',
        };
    }
    return null;
}
