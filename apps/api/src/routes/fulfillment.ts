import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ensureUser } from '../utils/ensure-user.js';
import { canEditSettings } from '../utils/workspace-permissions.js';
import { ensureBoardAccess } from '../utils/permissions.js';
import { mid } from '../utils/rank.js';
import { encryptSecret, decryptSecret } from '../utils/integrations.js';
import {
    FULFILLMENT_MODULE_KEY,
    FULFILLMENT_LIST_DEFS,
    buildTrackingUrl,
    isFulfillmentEntitled,
    getFulfillmentTelegramIntegration,
    getFulfillmentWebhookNotifyIntegration,
} from '../utils/fulfillment.js';
import { randomBytes } from 'node:crypto';

type BootstrapBody = { workspaceId: string; name?: string };
type OrderBody = {
    boardId: string;
    orderNumber: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    address?: string;
    itemsSummary?: string;
    totalAmount?: number | string;
    currency?: string;
    paidAt?: string;
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    notes?: string;
};
type SlaRuleBody = { rules: Array<{ listId: string; slaHours: number }> };

async function ensureWorkspaceMember(prisma: PrismaClient, workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!member) {
        const err: any = new Error('Forbidden');
        err.statusCode = 403;
        throw err;
    }
    return member;
}

async function ensureEntitled(prisma: PrismaClient, workspaceId: string) {
    const entitled = await isFulfillmentEntitled(prisma, workspaceId);
    if (!entitled) {
        const err: any = new Error('E-commerce Fulfillment module not active');
        err.statusCode = 403;
        throw err;
    }
}

async function sendTelegram(botToken: string, chatId: string, text: string) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
    });
}

function formatTelegramOrder(payload: {
    orderNumber: string;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    address?: string | null;
    itemsSummary?: string | null;
    totalAmount?: number | null;
    currency?: string | null;
    carrier?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    notes?: string | null;
}) {
    const total = payload.totalAmount !== null && payload.totalAmount !== undefined
        ? `${payload.totalAmount}${payload.currency ? ` ${payload.currency}` : ''}`
        : null;
    return [
        `New Fulfillment order`,
        `Order: ${payload.orderNumber}`,
        `Customer: ${payload.customerName}`,
        payload.customerPhone ? `Phone: ${payload.customerPhone}` : null,
        payload.customerEmail ? `Email: ${payload.customerEmail}` : null,
        payload.address ? `Address: ${payload.address}` : null,
        payload.itemsSummary ? `Items: ${payload.itemsSummary}` : null,
        total ? `Total: ${total}` : null,
        payload.carrier ? `Carrier: ${payload.carrier}` : null,
        payload.trackingNumber ? `Tracking: ${payload.trackingNumber}` : null,
        payload.trackingUrl ? `Tracking URL: ${payload.trackingUrl}` : null,
        payload.notes ? `Notes: ${payload.notes}` : null,
    ].filter(Boolean).join('\n');
}

function buildBaseUrl(req: FastifyRequest) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || (req.protocol ?? 'http');
    if (!host) return '';
    return `${proto}://${host}`;
}

async function sendWebhookNotify(url: string, payload: any) {
    await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

function formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function registerFulfillmentRoutes(app: FastifyInstance, prisma: PrismaClient) {
    app.get('/api/modules/ecommerce-fulfillment/workspaces/:workspaceId/entitlement', async (
        req: FastifyRequest<{ Params: { workspaceId: string } }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        await ensureWorkspaceMember(prisma, workspaceId, user.id);
        const client = prisma as PrismaClient & { workspaceEntitlement?: { findUnique: Function } };
        if (!client.workspaceEntitlement?.findUnique) {
            return { entitled: false, status: null, validUntil: null };
        }
        const now = new Date();
        const row = await client.workspaceEntitlement.findUnique({
            where: { workspaceId_moduleKey: { workspaceId, moduleKey: FULFILLMENT_MODULE_KEY } },
            select: { status: true, validUntil: true },
        });
        if (!row) return { entitled: false, status: null, validUntil: null };
        const entitled = row.status === 'active' && (!row.validUntil || row.validUntil >= now);
        return { entitled, status: row.status, validUntil: row.validUntil };
    });

    app.post('/api/modules/ecommerce-fulfillment/workspaces/:workspaceId/entitlement/mock', async (
        req: FastifyRequest<{ Params: { workspaceId: string } }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        const member = await ensureWorkspaceMember(prisma, workspaceId, user.id);
        if (!canEditSettings(member)) {
            const err: any = new Error('Forbidden');
            err.statusCode = 403;
            throw err;
        }
        await prisma.workspaceEntitlement.upsert({
            where: { workspaceId_moduleKey: { workspaceId, moduleKey: FULFILLMENT_MODULE_KEY } },
            update: { status: 'active', validUntil: null },
            create: { workspaceId, moduleKey: FULFILLMENT_MODULE_KEY, status: 'active' },
        });
        return { ok: true };
    });

    app.get('/api/modules/ecommerce-fulfillment/workspaces/:workspaceId/boards', async (
        req: FastifyRequest<{ Params: { workspaceId: string } }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        await ensureWorkspaceMember(prisma, workspaceId, user.id);
        await ensureEntitled(prisma, workspaceId);

        const boards = await prisma.board.findMany({
            where: { workspaceId, isArchived: false, type: 'ecommerce_fulfillment' },
            orderBy: { createdAt: 'desc' },
        });

        return boards.map(b => ({ id: b.id, name: b.name, workspaceId: b.workspaceId }));
    });

    app.post('/api/modules/ecommerce-fulfillment/bootstrap', async (
        req: FastifyRequest<{ Body: BootstrapBody }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId, name } = req.body ?? {};
        if (!workspaceId) {
            const err: any = new Error('workspaceId required');
            err.statusCode = 400;
            throw err;
        }
        await ensureWorkspaceMember(prisma, workspaceId, user.id);
        await ensureEntitled(prisma, workspaceId);

        const board = await prisma.$transaction(async tx => {
            const created = await tx.board.create({
                data: {
                    workspaceId,
                    name: name?.trim() || 'Fulfillment',
                    description: 'E-commerce fulfillment board',
                    type: 'ecommerce_fulfillment',
                    members: { create: { userId: user.id, role: 'owner' } },
                },
            });

            let prevRank: string | null = null;
            for (const def of FULFILLMENT_LIST_DEFS) {
                const rank = mid(prevRank ?? null);
                await tx.list.create({
                    data: {
                        boardId: created.id,
                        name: def.name,
                        rank,
                        statusKey: def.key,
                        isSystem: true,
                    },
                });
                prevRank = rank;
            }

            return created;
        });

        return { boardId: board.id };
    });

    app.post('/api/modules/ecommerce-fulfillment/orders', async (
        req: FastifyRequest<{ Body: OrderBody }>
    ) => {
        const user = ensureUser(req);
        const {
            boardId,
            orderNumber,
            customerName,
            customerPhone,
            customerEmail,
            address,
            itemsSummary,
            totalAmount,
            currency,
            paidAt,
            carrier,
            trackingNumber,
            trackingUrl,
            notes,
        } = req.body ?? {};

        if (!boardId || !orderNumber?.trim() || !customerName?.trim()) {
            const err: any = new Error('boardId, orderNumber, customerName required');
            err.statusCode = 400;
            throw err;
        }

        await ensureBoardAccess(prisma, boardId, user.id);
        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true, type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        if (board.type !== 'ecommerce_fulfillment') {
            const err: any = new Error('Board is not a Fulfillment board');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const orderList = await prisma.list.findFirst({
            where: { boardId, statusKey: 'order', isSystem: true },
            orderBy: { rank: 'asc' },
        });
        if (!orderList) {
            const err: any = new Error('Order list not found');
            err.statusCode = 404;
            throw err;
        }

        const prev = await prisma.card.findFirst({
            where: { listId: orderList.id },
            orderBy: { rank: 'desc' },
            select: { rank: true },
        });
        const rank = mid(prev?.rank ?? null);

        const paidDate = paidAt ? new Date(paidAt) : null;
        if (paidAt && isNaN(paidDate!.getTime())) {
            const err: any = new Error('paidAt must be ISO date');
            err.statusCode = 400;
            throw err;
        }

        const amount = totalAmount !== undefined && totalAmount !== null
            ? Number(totalAmount)
            : null;
        if (amount !== null && Number.isNaN(amount)) {
            const err: any = new Error('totalAmount must be number');
            err.statusCode = 400;
            throw err;
        }

        const resolvedTrackingUrl = trackingUrl?.trim()
            || buildTrackingUrl(carrier, trackingNumber);

        const created = await prisma.card.create({
            data: {
                listId: orderList.id,
                title: `Order ${orderNumber.trim()}`,
                description: notes?.trim() || null,
                rank,
                orderNumber: orderNumber.trim(),
                customerName: customerName.trim(),
                customerPhone: customerPhone?.trim() || null,
                customerEmail: customerEmail?.trim() || null,
                address: address?.trim() || null,
                itemsSummary: itemsSummary?.trim() || null,
                orderTotal: amount,
                orderCurrency: currency?.trim() || null,
                paidAt: paidDate,
                shippingCarrier: carrier?.trim() || null,
                trackingNumber: trackingNumber?.trim() || null,
                trackingUrl: resolvedTrackingUrl || null,
                lastStatusChangedAt: new Date(),
            },
        });

        const integration = await getFulfillmentTelegramIntegration(prisma, boardId, board.workspaceId);
        if (integration?.botTokenEncrypted && integration.chatId) {
            try {
                const token = decryptSecret(integration.botTokenEncrypted);
                const text = formatTelegramOrder({
                    orderNumber: created.orderNumber || orderNumber.trim(),
                    customerName: created.customerName || customerName.trim(),
                    customerPhone: created.customerPhone,
                    customerEmail: created.customerEmail,
                    address: created.address,
                    itemsSummary: created.itemsSummary,
                    totalAmount: created.orderTotal,
                    currency: created.orderCurrency,
                    carrier: created.shippingCarrier,
                    trackingNumber: created.trackingNumber,
                    trackingUrl: created.trackingUrl,
                    notes: created.description,
                });
                await sendTelegram(token, integration.chatId, text);
            } catch (err) {
                console.error('[Fulfillment] Telegram send failed', err);
            }
        }

        return { id: created.id, listId: created.listId };
    });

    app.get('/api/modules/ecommerce-fulfillment/boards/:boardId/sla', async (
        req: FastifyRequest<{ Params: { boardId: string } }>
    ) => {
        const user = ensureUser(req);
        const { boardId } = req.params;
        await ensureBoardAccess(prisma, boardId, user.id);

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true, type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        if (board.type !== 'ecommerce_fulfillment') {
            const err: any = new Error('Board is not a Fulfillment board');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const rules = await prisma.boardSlaRule.findMany({
            where: { boardId },
            select: { listId: true, slaHours: true },
        });
        return { rules };
    });

    app.put('/api/modules/ecommerce-fulfillment/boards/:boardId/sla', async (
        req: FastifyRequest<{ Params: { boardId: string }; Body: SlaRuleBody }>
    ) => {
        const user = ensureUser(req);
        const { boardId } = req.params;
        await ensureBoardAccess(prisma, boardId, user.id);

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true, type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        if (board.type !== 'ecommerce_fulfillment') {
            const err: any = new Error('Board is not a Fulfillment board');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const rules = req.body?.rules ?? [];
        const sanitized = rules
            .filter(r => r.listId && Number.isFinite(r.slaHours) && r.slaHours > 0)
            .map(r => ({ listId: r.listId, slaHours: Math.floor(r.slaHours) }));

        await prisma.$transaction(async tx => {
            const listIds = sanitized.map(r => r.listId);
            if (listIds.length) {
                await tx.boardSlaRule.deleteMany({
                    where: { boardId, listId: { notIn: listIds } },
                });
            } else {
                await tx.boardSlaRule.deleteMany({ where: { boardId } });
            }
            for (const rule of sanitized) {
                await tx.boardSlaRule.upsert({
                    where: { boardId_listId: { boardId, listId: rule.listId } },
                    update: { slaHours: rule.slaHours },
                    create: { boardId, listId: rule.listId, slaHours: rule.slaHours },
                });
            }
        });

        return { ok: true };
    });

    app.get('/api/modules/ecommerce-fulfillment/reports/weekly', async (
        req: FastifyRequest<{ Querystring: { boardId?: string; from?: string; to?: string } }>
    ) => {
        const user = ensureUser(req);
        const { boardId, from, to } = req.query ?? {};
        if (!boardId || !from || !to) {
            const err: any = new Error('boardId, from, to required');
            err.statusCode = 400;
            throw err;
        }
        const fromDate = new Date(`${from}T00:00:00`);
        const toDate = new Date(`${to}T23:59:59`);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            const err: any = new Error('from/to must be YYYY-MM-DD');
            err.statusCode = 400;
            throw err;
        }

        await ensureBoardAccess(prisma, boardId, user.id);
        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true, type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        if (board.type !== 'ecommerce_fulfillment') {
            const err: any = new Error('Board is not a Fulfillment board');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const lists = await prisma.list.findMany({
            where: { boardId },
            select: { id: true, statusKey: true },
        });
        const shippedListIds = new Set(
            lists.filter(l => l.statusKey === 'shipped').map(l => l.id)
        );
        const deliveredListIds = new Set(
            lists.filter(l => l.statusKey === 'delivered').map(l => l.id)
        );
        const returnedListIds = new Set(
            lists.filter(l => l.statusKey === 'returned').map(l => l.id)
        );
        const activeListIds = new Set(
            lists.filter(l => l.statusKey !== 'delivered' && l.statusKey !== 'returned').map(l => l.id)
        );

        const createdCount = await prisma.card.count({
            where: {
                list: { boardId },
                createdAt: { gte: fromDate, lte: toDate },
            },
        });

        const shippedCount = shippedListIds.size
            ? await prisma.card.count({
                where: {
                    listId: { in: Array.from(shippedListIds) },
                    lastStatusChangedAt: { gte: fromDate, lte: toDate },
                },
            })
            : 0;

        const deliveredCount = deliveredListIds.size
            ? await prisma.card.count({
                where: {
                    listId: { in: Array.from(deliveredListIds) },
                    lastStatusChangedAt: { gte: fromDate, lte: toDate },
                },
            })
            : 0;

        const returnedCount = returnedListIds.size
            ? await prisma.card.count({
                where: {
                    listId: { in: Array.from(returnedListIds) },
                    lastStatusChangedAt: { gte: fromDate, lte: toDate },
                },
            })
            : 0;

        const backlogCount = activeListIds.size
            ? await prisma.card.count({
                where: { listId: { in: Array.from(activeListIds) } },
            })
            : 0;

        const rules = await prisma.boardSlaRule.findMany({
            where: { boardId },
            select: { listId: true, slaHours: true },
        });
        const ruleMap = new Map(rules.map(r => [r.listId, r.slaHours]));
        let overdueCount = 0;
        if (ruleMap.size) {
            const candidates = await prisma.card.findMany({
                where: { listId: { in: Array.from(ruleMap.keys()) } },
                select: { listId: true, lastStatusChangedAt: true },
            });
            const now = Date.now();
            for (const card of candidates) {
                const hours = ruleMap.get(card.listId);
                if (!hours || !card.lastStatusChangedAt) continue;
                const overdueAt = new Date(card.lastStatusChangedAt).getTime() + hours * 60 * 60 * 1000;
                if (overdueAt < now) overdueCount += 1;
            }
        }

        let avgFulfillmentHours: number | null = null;
        if (shippedListIds.size) {
            const shippedCards = await prisma.card.findMany({
                where: {
                    listId: { in: Array.from(shippedListIds) },
                    lastStatusChangedAt: { gte: fromDate, lte: toDate },
                },
                select: { createdAt: true, lastStatusChangedAt: true },
            });
            if (shippedCards.length) {
                const totalHours = shippedCards.reduce((sum, card) => {
                    const start = card.createdAt?.getTime() ?? 0;
                    const end = card.lastStatusChangedAt?.getTime() ?? 0;
                    if (!start || !end) return sum;
                    return sum + (end - start) / (1000 * 60 * 60);
                }, 0);
                avgFulfillmentHours = Number((totalHours / shippedCards.length).toFixed(1));
            }
        }

        const days: string[] = [];
        for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
            days.push(formatLocalDate(d));
        }
        const createdByDay = new Map(days.map(day => [day, 0]));
        const shippedByDay = new Map(days.map(day => [day, 0]));

        const createdCards = await prisma.card.findMany({
            where: {
                list: { boardId },
                createdAt: { gte: fromDate, lte: toDate },
            },
            select: { createdAt: true },
        });
        for (const card of createdCards) {
            const key = formatLocalDate(card.createdAt);
            if (createdByDay.has(key)) createdByDay.set(key, (createdByDay.get(key) || 0) + 1);
        }

        if (shippedListIds.size) {
            const shippedCardsByDay = await prisma.card.findMany({
                where: {
                    listId: { in: Array.from(shippedListIds) },
                    lastStatusChangedAt: { gte: fromDate, lte: toDate },
                },
                select: { lastStatusChangedAt: true },
            });
            for (const card of shippedCardsByDay) {
                const key = formatLocalDate(card.lastStatusChangedAt);
                if (shippedByDay.has(key)) shippedByDay.set(key, (shippedByDay.get(key) || 0) + 1);
            }
        }

        return {
            created: createdCount,
            shipped: shippedCount,
            delivered: deliveredCount,
            returned: returnedCount,
            overdue: overdueCount,
            backlog: backlogCount,
            avgFulfillmentHours,
            daily: {
                created: days.map(date => ({ date, count: createdByDay.get(date) || 0 })),
                shipped: days.map(date => ({ date, count: shippedByDay.get(date) || 0 })),
            },
        };
    });

    app.post('/api/modules/ecommerce-fulfillment/workspaces/:workspaceId/webhook', async (
        req: FastifyRequest<{ Params: { workspaceId: string } }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        const integrationsClient = (prisma as any).workspaceIntegration;
        if (!integrationsClient?.upsert) {
            const err: any = new Error('WorkspaceIntegration not available. Run migrations and regenerate Prisma client.');
            err.statusCode = 500;
            throw err;
        }
        const member = await ensureWorkspaceMember(prisma, workspaceId, user.id);
        if (!canEditSettings(member)) {
            const err: any = new Error('Forbidden');
            err.statusCode = 403;
            throw err;
        }
        await ensureEntitled(prisma, workspaceId);

        const secret = randomBytes(16).toString('hex');
        const encrypted = encryptSecret(secret);
        await integrationsClient.upsert({
            where: { workspaceId_type: { workspaceId, type: 'webhook' } },
            update: { webhookSecretEncrypted: encrypted },
            create: { workspaceId, type: 'webhook', webhookSecretEncrypted: encrypted },
        });

        const baseUrl = buildBaseUrl(req);
        const path = `/api/modules/ecommerce-fulfillment/webhooks/${workspaceId}/${secret}`;
        return { url: baseUrl ? `${baseUrl}${path}` : path, path };
    });

    app.get('/api/modules/ecommerce-fulfillment/workspaces/:workspaceId/webhook/notify', async (
        req: FastifyRequest<{ Params: { workspaceId: string } }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        await ensureWorkspaceMember(prisma, workspaceId, user.id);
        await ensureEntitled(prisma, workspaceId);

        const integration = await prisma.workspaceIntegration.findUnique({
            where: { workspaceId_type: { workspaceId, type: 'webhook' } },
            select: { webhookNotifyUrlEncrypted: true },
        });

        return {
            configured: !!integration?.webhookNotifyUrlEncrypted,
            url: integration?.webhookNotifyUrlEncrypted
                ? decryptSecret(integration.webhookNotifyUrlEncrypted)
                : null,
            source: 'workspace',
        };
    });

    app.put('/api/modules/ecommerce-fulfillment/workspaces/:workspaceId/webhook/notify', async (
        req: FastifyRequest<{ Params: { workspaceId: string }; Body: { url: string } }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        const { url } = req.body ?? {};
        const member = await ensureWorkspaceMember(prisma, workspaceId, user.id);
        if (!canEditSettings(member)) {
            const err: any = new Error('Forbidden');
            err.statusCode = 403;
            throw err;
        }
        await ensureEntitled(prisma, workspaceId);

        const encrypted = url?.trim() ? encryptSecret(url.trim()) : null;
        await prisma.workspaceIntegration.upsert({
            where: { workspaceId_type: { workspaceId, type: 'webhook' } },
            update: { webhookNotifyUrlEncrypted: encrypted },
            create: { workspaceId, type: 'webhook', webhookNotifyUrlEncrypted: encrypted },
        });

        return { ok: true };
    });

    app.get('/api/modules/ecommerce-fulfillment/boards/:boardId/webhook/notify', async (
        req: FastifyRequest<{ Params: { boardId: string } }>
    ) => {
        const user = ensureUser(req);
        const { boardId } = req.params;
        await ensureBoardAccess(prisma, boardId, user.id);

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true, type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        if (board.type !== 'ecommerce_fulfillment') {
            const err: any = new Error('Board is not a Fulfillment board');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const integration = await getFulfillmentWebhookNotifyIntegration(prisma, boardId, board.workspaceId);
        return {
            configured: !!integration?.webhookNotifyUrlEncrypted,
            url: integration?.webhookNotifyUrlEncrypted
                ? decryptSecret(integration.webhookNotifyUrlEncrypted)
                : null,
            source: integration?.source ?? 'none',
        };
    });

    app.put('/api/modules/ecommerce-fulfillment/boards/:boardId/webhook/notify', async (
        req: FastifyRequest<{ Params: { boardId: string }; Body: { url: string } }>
    ) => {
        const user = ensureUser(req);
        const { boardId } = req.params;
        const { url } = req.body ?? {};
        await ensureBoardAccess(prisma, boardId, user.id);

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true, type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        if (board.type !== 'ecommerce_fulfillment') {
            const err: any = new Error('Board is not a Fulfillment board');
            err.statusCode = 400;
            throw err;
        }
        const member = await ensureWorkspaceMember(prisma, board.workspaceId, user.id);
        if (!canEditSettings(member)) {
            const err: any = new Error('Forbidden');
            err.statusCode = 403;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const boardClient = (prisma as any).boardIntegration;
        if (!boardClient?.upsert) {
            const err: any = new Error('BoardIntegration not available. Run migrations and regenerate Prisma client.');
            err.statusCode = 500;
            throw err;
        }

        const encrypted = url?.trim() ? encryptSecret(url.trim()) : null;
        await boardClient.upsert({
            where: { boardId_type: { boardId, type: 'webhook' } },
            update: { webhookNotifyUrlEncrypted: encrypted },
            create: { boardId, type: 'webhook', webhookNotifyUrlEncrypted: encrypted },
        });

        return { ok: true };
    });

    app.post('/api/modules/ecommerce-fulfillment/webhooks/:workspaceId/:secret', async (
        req: FastifyRequest<{
            Params: { workspaceId: string; secret: string };
            Body: {
                boardId?: string;
                orderNumber: string;
                customerName: string;
                customerPhone?: string;
                customerEmail?: string;
                address?: string;
                itemsSummary?: string;
                totalAmount?: number | string;
                currency?: string;
                paidAt?: string;
                carrier?: string;
                trackingNumber?: string;
                trackingUrl?: string;
                notes?: string;
            };
        }>
    ) => {
        const { workspaceId, secret } = req.params;
        const integrationsClient = (prisma as any).workspaceIntegration;
        if (!integrationsClient?.findUnique) {
            const err: any = new Error('WorkspaceIntegration not available. Run migrations and regenerate Prisma client.');
            err.statusCode = 500;
            throw err;
        }
        const webhookIntegration = await integrationsClient.findUnique({
            where: { workspaceId_type: { workspaceId, type: 'webhook' } },
            select: { webhookSecretEncrypted: true },
        });
        if (!webhookIntegration?.webhookSecretEncrypted) {
            const err: any = new Error('Webhook not configured');
            err.statusCode = 404;
            throw err;
        }
        const storedSecret = decryptSecret(webhookIntegration.webhookSecretEncrypted);
        if (storedSecret !== secret) {
            const err: any = new Error('Unauthorized');
            err.statusCode = 401;
            throw err;
        }
        await ensureEntitled(prisma, workspaceId);

        const {
            boardId,
            orderNumber,
            customerName,
            customerPhone,
            customerEmail,
            address,
            itemsSummary,
            totalAmount,
            currency,
            paidAt,
            carrier,
            trackingNumber,
            trackingUrl,
            notes,
        } = req.body ?? {};

        if (!orderNumber?.trim() || !customerName?.trim()) {
            const err: any = new Error('orderNumber and customerName required');
            err.statusCode = 400;
            throw err;
        }

        let targetBoardId = boardId;
        if (!targetBoardId) {
            const latest = await prisma.board.findFirst({
                where: { workspaceId, type: 'ecommerce_fulfillment', isArchived: false },
                orderBy: { createdAt: 'desc' },
                select: { id: true },
            });
            targetBoardId = latest?.id ?? '';
        }
        if (!targetBoardId) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }

        const orderList = await prisma.list.findFirst({
            where: { boardId: targetBoardId, statusKey: 'order', isSystem: true },
            orderBy: { rank: 'asc' },
        });
        if (!orderList) {
            const err: any = new Error('Order list not found');
            err.statusCode = 404;
            throw err;
        }

        const prev = await prisma.card.findFirst({
            where: { listId: orderList.id },
            orderBy: { rank: 'desc' },
            select: { rank: true },
        });
        const rank = mid(prev?.rank ?? null);

        const paidDate = paidAt ? new Date(paidAt) : null;
        if (paidAt && isNaN(paidDate!.getTime())) {
            const err: any = new Error('paidAt must be ISO date');
            err.statusCode = 400;
            throw err;
        }
        const amount = totalAmount !== undefined && totalAmount !== null
            ? Number(totalAmount)
            : null;
        if (amount !== null && Number.isNaN(amount)) {
            const err: any = new Error('totalAmount must be number');
            err.statusCode = 400;
            throw err;
        }

        const resolvedTrackingUrl = trackingUrl?.trim()
            || buildTrackingUrl(carrier, trackingNumber);

        const created = await prisma.card.create({
            data: {
                listId: orderList.id,
                title: `Order ${orderNumber.trim()}`,
                description: notes?.trim() || null,
                rank,
                orderNumber: orderNumber.trim(),
                customerName: customerName.trim(),
                customerPhone: customerPhone?.trim() || null,
                customerEmail: customerEmail?.trim() || null,
                address: address?.trim() || null,
                itemsSummary: itemsSummary?.trim() || null,
                orderTotal: amount,
                orderCurrency: currency?.trim() || null,
                paidAt: paidDate,
                shippingCarrier: carrier?.trim() || null,
                trackingNumber: trackingNumber?.trim() || null,
                trackingUrl: resolvedTrackingUrl || null,
                lastStatusChangedAt: new Date(),
            },
        });

        const integration = await getFulfillmentTelegramIntegration(prisma, targetBoardId, workspaceId);
        if (integration?.botTokenEncrypted && integration.chatId) {
            try {
                const token = decryptSecret(integration.botTokenEncrypted);
                const text = formatTelegramOrder({
                    orderNumber: created.orderNumber || orderNumber.trim(),
                    customerName: created.customerName || customerName.trim(),
                    customerPhone: created.customerPhone,
                    customerEmail: created.customerEmail,
                    address: created.address,
                    itemsSummary: created.itemsSummary,
                    totalAmount: created.orderTotal,
                    currency: created.orderCurrency,
                    carrier: created.shippingCarrier,
                    trackingNumber: created.trackingNumber,
                    trackingUrl: created.trackingUrl,
                    notes: created.description,
                });
                await sendTelegram(token, integration.chatId, text);
            } catch (err) {
                console.error('[Fulfillment] Telegram send failed', err);
            }
        }

        const webhook = await getFulfillmentWebhookNotifyIntegration(prisma, targetBoardId, workspaceId);
        if (webhook?.webhookNotifyUrlEncrypted) {
            try {
                const url = decryptSecret(webhook.webhookNotifyUrlEncrypted);
                await sendWebhookNotify(url, {
                    event: 'order.created',
                    cardId: created.id,
                    boardId: targetBoardId,
                    listId: created.listId,
                    orderNumber: created.orderNumber,
                    customerName: created.customerName,
                    customerPhone: created.customerPhone,
                    customerEmail: created.customerEmail,
                    address: created.address,
                    itemsSummary: created.itemsSummary,
                    totalAmount: created.orderTotal,
                    currency: created.orderCurrency,
                    carrier: created.shippingCarrier,
                    trackingNumber: created.trackingNumber,
                    trackingUrl: created.trackingUrl,
                    createdAt: created.createdAt.toISOString(),
                });
            } catch (err) {
                console.error('[Fulfillment] Webhook send failed', err);
            }
        }

        return { id: created.id, listId: created.listId };
    });

    app.get('/api/modules/ecommerce-fulfillment/boards/:boardId/telegram', async (
        req: FastifyRequest<{ Params: { boardId: string } }>
    ) => {
        const user = ensureUser(req);
        const { boardId } = req.params;
        await ensureBoardAccess(prisma, boardId, user.id);

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true, type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        if (board.type !== 'ecommerce_fulfillment') {
            const err: any = new Error('Board is not a Fulfillment board');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const integration = await getFulfillmentTelegramIntegration(prisma, boardId, board.workspaceId);
        return {
            configured: !!integration?.botTokenEncrypted && !!integration?.chatId,
            chatId: integration?.chatId ?? null,
            hasBotToken: !!integration?.botTokenEncrypted,
            source: integration?.source ?? 'none',
        };
    });

    app.put('/api/modules/ecommerce-fulfillment/boards/:boardId/telegram', async (
        req: FastifyRequest<{ Params: { boardId: string }; Body: { botToken: string; chatId: string } }>
    ) => {
        const user = ensureUser(req);
        const { boardId } = req.params;
        const { botToken, chatId } = req.body ?? {};
        if (!botToken?.trim() || !chatId?.trim()) {
            const err: any = new Error('botToken and chatId required');
            err.statusCode = 400;
            throw err;
        }
        await ensureBoardAccess(prisma, boardId, user.id);

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true, type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        if (board.type !== 'ecommerce_fulfillment') {
            const err: any = new Error('Board is not a Fulfillment board');
            err.statusCode = 400;
            throw err;
        }
        const member = await ensureWorkspaceMember(prisma, board.workspaceId, user.id);
        if (!canEditSettings(member)) {
            const err: any = new Error('Forbidden');
            err.statusCode = 403;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const boardClient = (prisma as any).boardIntegration;
        if (!boardClient?.upsert) {
            const err: any = new Error('BoardIntegration not available. Run migrations and regenerate Prisma client.');
            err.statusCode = 500;
            throw err;
        }

        const encrypted = encryptSecret(botToken.trim());
        await boardClient.upsert({
            where: { boardId_type: { boardId, type: 'telegram' } },
            update: { botTokenEncrypted: encrypted, chatId: chatId.trim() },
            create: { boardId, type: 'telegram', botTokenEncrypted: encrypted, chatId: chatId.trim() },
        });

        return { ok: true };
    });

    app.put('/api/modules/ecommerce-fulfillment/workspaces/:workspaceId/telegram', async (
        req: FastifyRequest<{ Params: { workspaceId: string }; Body: { botToken: string; chatId: string } }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        const { botToken, chatId } = req.body ?? {};
        if (!botToken?.trim() || !chatId?.trim()) {
            const err: any = new Error('botToken and chatId required');
            err.statusCode = 400;
            throw err;
        }

        await ensureWorkspaceMember(prisma, workspaceId, user.id);
        await ensureEntitled(prisma, workspaceId);

        const encrypted = encryptSecret(botToken.trim());
        await prisma.workspaceIntegration.upsert({
            where: { workspaceId_type: { workspaceId, type: 'telegram' } },
            update: { botTokenEncrypted: encrypted, chatId: chatId.trim() },
            create: { workspaceId, type: 'telegram', botTokenEncrypted: encrypted, chatId: chatId.trim() },
        });

        return { ok: true };
    });

    app.get('/api/modules/ecommerce-fulfillment/workspaces/:workspaceId/telegram', async (
        req: FastifyRequest<{ Params: { workspaceId: string } }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        await ensureWorkspaceMember(prisma, workspaceId, user.id);
        await ensureEntitled(prisma, workspaceId);

        const integration = await prisma.workspaceIntegration.findUnique({
            where: { workspaceId_type: { workspaceId, type: 'telegram' } },
            select: { botTokenEncrypted: true, chatId: true },
        });

        return {
            configured: !!integration?.botTokenEncrypted && !!integration?.chatId,
            chatId: integration?.chatId ?? null,
            hasBotToken: !!integration?.botTokenEncrypted,
            source: 'workspace',
        };
    });
}
