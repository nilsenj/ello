import type { PrismaClient } from '@prisma/client';

export const FULFILLMENT_MODULE_KEY = 'ecommerce_fulfillment';
export const FULFILLMENT_STATUS_KEYS = [
    'order',
    'packing',
    'shipped',
    'delivered',
    'returned',
] as const;

export type FulfillmentStatusKey = typeof FULFILLMENT_STATUS_KEYS[number];

export const FULFILLMENT_LIST_DEFS: Array<{ key: FulfillmentStatusKey; name: string }> = [
    { key: 'order', name: 'Orders' },
    { key: 'packing', name: 'Packing' },
    { key: 'shipped', name: 'Shipped' },
    { key: 'delivered', name: 'Delivered' },
    { key: 'returned', name: 'Returned' },
];

const TRACKING_URL_BUILDERS: Record<string, (trackingNumber: string) => string> = {
    ups: (tracking) => `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(tracking)}`,
    usps: (tracking) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(tracking)}`,
    fedex: (tracking) => `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(tracking)}`,
    dhl: (tracking) => `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(tracking)}`,
    dpd: (tracking) => `https://www.dpd.com/en/mydpd/my-parcels/track/?parcelNumber=${encodeURIComponent(tracking)}`,
    royalmail: (tracking) => `https://www.royalmail.com/track-your-item?trackNumber=${encodeURIComponent(tracking)}`,
    novaposhta: (tracking) => `https://tracking.novaposhta.ua/#/en/np/${encodeURIComponent(tracking)}`,
    ukrposhta: (tracking) => `https://track.ukrposhta.ua/ua?barcode=${encodeURIComponent(tracking)}`,
    gls: (tracking) => `https://gls-group.eu/track/${encodeURIComponent(tracking)}`,
};

export function normalizeCarrier(value?: string | null) {
    if (!value) return '';
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveCarrierKey(value: string): string | null {
    const normalized = normalizeCarrier(value);
    if (!normalized) return null;
    if (TRACKING_URL_BUILDERS[normalized]) return normalized;
    if (normalized.startsWith('fedex')) return 'fedex';
    if (normalized.startsWith('ups')) return 'ups';
    if (normalized.startsWith('usps')) return 'usps';
    if (normalized.startsWith('dhl')) return 'dhl';
    if (normalized.startsWith('dpd')) return 'dpd';
    if (normalized.startsWith('royalmail')) return 'royalmail';
    if (normalized.startsWith('nova') || normalized.startsWith('novaposhta')) return 'novaposhta';
    if (normalized.startsWith('ukrposhta')) return 'ukrposhta';
    if (normalized.startsWith('gls')) return 'gls';
    return null;
}

export function buildTrackingUrl(
    carrier?: string | null,
    trackingNumber?: string | null,
): string | null {
    if (!carrier || !trackingNumber) return null;
    const key = resolveCarrierKey(carrier);
    if (!key) return null;
    const builder = TRACKING_URL_BUILDERS[key];
    return builder ? builder(trackingNumber.trim()) : null;
}

export async function isFulfillmentEntitled(prisma: PrismaClient, workspaceId: string) {
    const client = prisma as PrismaClient & { workspaceEntitlement?: { findUnique: Function } };
    if (!client.workspaceEntitlement?.findUnique) return false;
    const now = new Date();
    const row = await client.workspaceEntitlement.findUnique({
        where: { workspaceId_moduleKey: { workspaceId, moduleKey: FULFILLMENT_MODULE_KEY } },
        select: { status: true, validUntil: true },
    });
    if (!row) return false;
    if (row.status !== 'active') return false;
    if (row.validUntil && row.validUntil < now) return false;
    return true;
}

export type FulfillmentIntegrationSource = 'board' | 'workspace';

export async function getFulfillmentTelegramIntegration(
    prisma: PrismaClient,
    boardId: string,
    workspaceId: string,
): Promise<{ botTokenEncrypted: string; chatId: string; source: FulfillmentIntegrationSource } | null> {
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

export async function getFulfillmentWebhookNotifyIntegration(
    prisma: PrismaClient,
    boardId: string,
    workspaceId: string,
): Promise<{ webhookNotifyUrlEncrypted: string; source: FulfillmentIntegrationSource } | null> {
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
