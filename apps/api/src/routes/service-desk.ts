import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ensureUser } from '../utils/ensure-user.js';
import { canCreateBoards, canEditSettings } from '../utils/workspace-permissions.js';
import { ensureBoardAccess } from '../utils/permissions.js';
import { mid } from '../utils/rank.js';
import { encryptSecret, decryptSecret } from '../utils/integrations.js';
import {
    SERVICE_DESK_MODULE_KEY,
    isWorkspaceEntitled,
    SERVICE_DESK_LIST_DEFS,
    getServiceDeskTelegramIntegration,
    getServiceDeskWebhookNotifyIntegration,
} from '../utils/service-desk.js';
import { randomBytes } from 'node:crypto';


type BootstrapBody = { workspaceId: string; name?: string };
type RequestBody = {
    boardId: string;
    customerName: string;
    customerPhone: string;
    address?: string;
    serviceType?: string;
    notes?: string;
    scheduledAt?: string;
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
    const entitled = await isWorkspaceEntitled(prisma, workspaceId);
    if (!entitled) {
        const err: any = new Error('Service Desk module not active');
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

function formatTelegramRequest(payload: {
    customerName: string;
    customerPhone: string;
    address?: string | null;
    serviceType?: string | null;
    notes?: string | null;
}) {
    return [
        `New Service Desk request`,
        `Customer: ${payload.customerName}`,
        `Phone: ${payload.customerPhone}`,
        payload.address ? `Address: ${payload.address}` : null,
        payload.serviceType ? `Service: ${payload.serviceType}` : null,
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

export async function registerServiceDeskRoutes(app: FastifyInstance, prisma: PrismaClient) {
    app.get('/api/modules/service-desk/workspaces/:workspaceId/entitlement', async (
        req: FastifyRequest<{ Params: { workspaceId: string } }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        await ensureWorkspaceMember(prisma, workspaceId, user.id);
        const entitled = await isWorkspaceEntitled(prisma, workspaceId);
        return { entitled };
    });

    // Mock purchase endpoint (dev-only UX)
    app.post('/api/modules/service-desk/workspaces/:workspaceId/entitlement/mock', async (
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
            where: { workspaceId_moduleKey: { workspaceId, moduleKey: SERVICE_DESK_MODULE_KEY } },
            update: { status: 'active', validUntil: null },
            create: { workspaceId, moduleKey: SERVICE_DESK_MODULE_KEY, status: 'active' },
        });
        return { ok: true };
    });

    app.get('/api/modules/service-desk/workspaces/:workspaceId/boards', async (
        req: FastifyRequest<{ Params: { workspaceId: string } }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        await ensureWorkspaceMember(prisma, workspaceId, user.id);
        await ensureEntitled(prisma, workspaceId);

        const boards = await prisma.board.findMany({
            where: { workspaceId, isArchived: false, type: 'service_desk' },
            orderBy: { createdAt: 'desc' },
        });

        return boards.map(b => ({ id: b.id, name: b.name, workspaceId: b.workspaceId }));
    });

    app.post('/api/modules/service-desk/bootstrap', async (
        req: FastifyRequest<{ Body: BootstrapBody }>
    ) => {
        const user = ensureUser(req);
        const { workspaceId, name } = req.body ?? {};
        if (!workspaceId) {
            const err: any = new Error('workspaceId required');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, workspaceId);

        const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (!workspace) {
            const err: any = new Error('Workspace not found');
            err.statusCode = 404;
            throw err;
        }

        const member = await ensureWorkspaceMember(prisma, workspaceId, user.id);
        if (!canCreateBoards(workspace, member)) {
            const err: any = new Error('Forbidden');
            err.statusCode = 403;
            throw err;
        }

        const baseName = (name?.trim() || 'Service Desk');
        const existing = await prisma.board.findMany({
            where: { workspaceId },
            select: { name: true },
        });
        const names = new Set(existing.map(b => b.name.toLowerCase()));
        let boardName = baseName;
        if (names.has(boardName.toLowerCase())) {
            let counter = 2;
            boardName = `${baseName} (${counter})`;
            while (names.has(boardName.toLowerCase())) {
                counter++;
                boardName = `${baseName} (${counter})`;
            }
        }

        const board = await prisma.$transaction(async tx => {
            const created = await tx.board.create({
                data: {
                    workspaceId,
                    name: boardName,
                    description: 'Service desk workflow',
                    visibility: workspace.defaultBoardVisibility ?? 'workspace',
                    type: 'service_desk',
                    members: { create: { userId: user.id, role: member.role } },
                },
            });

            let prevRank: string | null = null;
            for (const def of SERVICE_DESK_LIST_DEFS) {
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

    // Generate webhook secret URL (authenticated)
    app.post('/api/modules/service-desk/workspaces/:workspaceId/webhook', async (
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
        const path = `/api/modules/service-desk/webhooks/${workspaceId}/${secret}`;
        return { url: baseUrl ? `${baseUrl}${path}` : path, path };
    });

    app.get('/api/modules/service-desk/workspaces/:workspaceId/webhook/notify', async (
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

    app.put('/api/modules/service-desk/workspaces/:workspaceId/webhook/notify', async (
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

    app.get('/api/modules/service-desk/boards/:boardId/webhook/notify', async (
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
        if (board.type !== 'service_desk') {
            const err: any = new Error('Board is not a Service Desk board');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const integration = await getServiceDeskWebhookNotifyIntegration(prisma, boardId, board.workspaceId);
        return {
            configured: !!integration?.webhookNotifyUrlEncrypted,
            url: integration?.webhookNotifyUrlEncrypted
                ? decryptSecret(integration.webhookNotifyUrlEncrypted)
                : null,
            source: integration?.source ?? 'none',
        };
    });

    app.put('/api/modules/service-desk/boards/:boardId/webhook/notify', async (
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
        if (board.type !== 'service_desk') {
            const err: any = new Error('Board is not a Service Desk board');
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

    // Webhook intake (unauthenticated)
    app.post('/api/modules/service-desk/webhooks/:workspaceId/:secret', async (
        req: FastifyRequest<{
            Params: { workspaceId: string; secret: string };
            Body: {
                boardId?: string;
                customerName: string;
                customerPhone: string;
                address?: string;
                serviceType?: string;
                notes?: string;
                scheduledAt?: string;
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

        const body = req.body ?? {};
        if (!body.customerName?.trim() || !body.customerPhone?.trim()) {
            const err: any = new Error('customerName and customerPhone required');
            err.statusCode = 400;
            throw err;
        }

        let boardId = body.boardId || '';
        if (!boardId) {
            const inbox = await prisma.list.findFirst({
                where: { board: { workspaceId, type: 'service_desk' }, statusKey: 'inbox', isSystem: true },
                select: { boardId: true },
                orderBy: { createdAt: 'asc' },
            });
            boardId = inbox?.boardId ?? '';
        }
        if (!boardId) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true, type: true },
        });
        if (!board || board.workspaceId !== workspaceId) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        if (board.type !== 'service_desk') {
            const err: any = new Error('Board is not a Service Desk board');
            err.statusCode = 400;
            throw err;
        }

        const inboxList = await prisma.list.findFirst({
            where: { boardId, statusKey: 'inbox', isSystem: true },
            select: { id: true, statusKey: true, isSystem: true },
        });
        if (!inboxList) {
            const err: any = new Error('Inbox list not found');
            err.statusCode = 400;
            throw err;
        }

        const prev = await prisma.card.findFirst({
            where: { listId: inboxList.id },
            orderBy: { rank: 'desc' },
            select: { rank: true },
        });
        const rank = mid(prev?.rank ?? null);

        const scheduledDate = body.scheduledAt ? new Date(body.scheduledAt) : null;
        if (body.scheduledAt && isNaN(scheduledDate!.getTime())) {
            const err: any = new Error('scheduledAt must be ISO date');
            err.statusCode = 400;
            throw err;
        }

        const created = await prisma.card.create({
            data: {
                listId: inboxList.id,
                title: `Request: ${body.customerName.trim()}`,
                description: body.notes?.trim() || null,
                rank,
                customerName: body.customerName.trim(),
                customerPhone: body.customerPhone.trim(),
                address: body.address?.trim() || null,
                serviceType: body.serviceType?.trim() || null,
                scheduledAt: scheduledDate,
                lastStatusChangedAt: new Date(),
            },
        });

        const integration = await getServiceDeskTelegramIntegration(prisma, boardId, workspaceId);
        if (integration?.botTokenEncrypted && integration.chatId) {
            try {
                const token = decryptSecret(integration.botTokenEncrypted);
                const text = formatTelegramRequest({
                    customerName: created.customerName,
                    customerPhone: created.customerPhone,
                    address: created.address,
                    serviceType: created.serviceType,
                    notes: created.description,
                });
                await sendTelegram(token, integration.chatId, text);
            } catch (err) {
                console.error('[ServiceDesk] Telegram send failed', err);
            }
        }

        return { id: created.id, listId: created.listId };
    });

    app.post('/api/modules/service-desk/requests', async (
        req: FastifyRequest<{ Body: RequestBody }>
    ) => {
        const user = ensureUser(req);
        const body = req.body ?? {};
        const { boardId, customerName, customerPhone, address, serviceType, notes, scheduledAt } = body;
        if (!boardId || !customerName?.trim() || !customerPhone?.trim()) {
            const err: any = new Error('boardId, customerName, customerPhone required');
            err.statusCode = 400;
            throw err;
        }

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true, type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }
        if (board.type !== 'service_desk') {
            const err: any = new Error('Board is not a Service Desk board');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);
        await ensureBoardAccess(prisma, boardId, user.id);

        const inbox = await prisma.list.findFirst({
            where: { boardId, statusKey: 'inbox', isSystem: true },
            select: { id: true },
        });
        if (!inbox) {
            const err: any = new Error('Inbox list not found');
            err.statusCode = 400;
            throw err;
        }

        const prev = await prisma.card.findFirst({
            where: { listId: inbox.id },
            orderBy: { rank: 'desc' },
            select: { rank: true },
        });
        const rank = mid(prev?.rank ?? null);

        const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
        if (scheduledAt && isNaN(scheduledDate!.getTime())) {
            const err: any = new Error('scheduledAt must be ISO date');
            err.statusCode = 400;
            throw err;
        }

        const created = await prisma.card.create({
            data: {
                listId: inbox.id,
                title: `Request: ${customerName.trim()}`,
                description: notes?.trim() || null,
                rank,
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                address: address?.trim() || null,
                serviceType: serviceType?.trim() || null,
                scheduledAt: scheduledDate,
                lastStatusChangedAt: new Date(),
            },
        });

        const integration = await getServiceDeskTelegramIntegration(prisma, boardId, board.workspaceId);
        if (integration?.botTokenEncrypted && integration.chatId) {
            try {
                const token = decryptSecret(integration.botTokenEncrypted);
                const text = formatTelegramRequest({
                    customerName: created.customerName,
                    customerPhone: created.customerPhone,
                    address: created.address,
                    serviceType: created.serviceType,
                    notes: created.description,
                });
                await sendTelegram(token, integration.chatId, text);
            } catch (err) {
                console.error('[ServiceDesk] Telegram send failed', err);
            }
        }

        return { id: created.id, listId: created.listId };
    });

    app.get('/api/modules/service-desk/boards/:boardId/sla', async (
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
        if (board.type !== 'service_desk') {
            const err: any = new Error('Board is not a Service Desk board');
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

    app.put('/api/modules/service-desk/boards/:boardId/sla', async (
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
        if (board.type !== 'service_desk') {
            const err: any = new Error('Board is not a Service Desk board');
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

    app.get('/api/modules/service-desk/reports/weekly', async (
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
        if (board.type !== 'service_desk') {
            const err: any = new Error('Board is not a Service Desk board');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const lists = await prisma.list.findMany({
            where: { boardId },
            select: { id: true, statusKey: true },
        });
        const doneListIds = new Set(
            lists.filter(l => l.statusKey === 'done').map(l => l.id)
        );
        const canceledListIds = new Set(
            lists.filter(l => l.statusKey === 'canceled').map(l => l.id)
        );

        const createdCount = await prisma.card.count({
            where: {
                list: { boardId },
                createdAt: { gte: fromDate, lte: toDate },
            },
        });

        const doneIds = Array.from(doneListIds);
        const closedCount = doneIds.length
            ? await prisma.card.count({
                where: {
                    listId: { in: doneIds },
                    lastStatusChangedAt: { gte: fromDate, lte: toDate },
                },
            })
            : 0;

        const backlogCount = await prisma.card.count({
            where: {
                list: { boardId },
                listId: { notIn: [...doneListIds, ...canceledListIds] },
            },
        });

        const rules = await prisma.boardSlaRule.findMany({
            where: { boardId },
            select: { listId: true, slaHours: true },
        });
        const ruleMap = new Map(rules.map(r => [r.listId, r.slaHours]));
        const candidates = await prisma.card.findMany({
            where: {
                listId: { in: Array.from(ruleMap.keys()) },
                list: { boardId },
            },
            select: { id: true, listId: true, lastStatusChangedAt: true },
        });

        const overdueCount = candidates.filter(c => {
            if (doneListIds.has(c.listId) || canceledListIds.has(c.listId)) return false;
            const hours = ruleMap.get(c.listId);
            if (!hours) return false;
            const overdueAt = new Date(c.lastStatusChangedAt);
            overdueAt.setHours(overdueAt.getHours() + hours);
            return overdueAt >= fromDate && overdueAt <= toDate;
        }).length;

        const closedCards = doneIds.length
            ? await prisma.card.findMany({
                where: {
                    listId: { in: doneIds },
                    lastStatusChangedAt: { gte: fromDate, lte: toDate },
                },
                select: { createdAt: true, lastStatusChangedAt: true },
            })
            : [];
        const avgResolutionHours = closedCards.length
            ? Math.round(
                (closedCards.reduce((sum, c) => {
                    const diffMs = c.lastStatusChangedAt.getTime() - c.createdAt.getTime();
                    return sum + Math.max(0, diffMs);
                }, 0) / closedCards.length / 3600000) * 10
            ) / 10
            : null;

        const formatLocalDate = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const days: string[] = [];
        const cursor = new Date(fromDate);
        cursor.setHours(0, 0, 0, 0);
        while (cursor <= toDate) {
            days.push(formatLocalDate(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        const createdByDay = new Map(days.map(d => [d, 0]));
        const closedByDay = new Map(days.map(d => [d, 0]));

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

        if (doneIds.length) {
            const closedCardsByDay = await prisma.card.findMany({
                where: {
                    listId: { in: doneIds },
                    lastStatusChangedAt: { gte: fromDate, lte: toDate },
                },
                select: { lastStatusChangedAt: true },
            });
            for (const card of closedCardsByDay) {
                const key = formatLocalDate(card.lastStatusChangedAt);
                if (closedByDay.has(key)) closedByDay.set(key, (closedByDay.get(key) || 0) + 1);
            }
        }

        return {
            created: createdCount,
            closed: closedCount,
            overdue: overdueCount,
            backlog: backlogCount,
            avgResolutionHours,
            daily: {
                created: days.map(date => ({ date, count: createdByDay.get(date) || 0 })),
                closed: days.map(date => ({ date, count: closedByDay.get(date) || 0 })),
            },
        };
    });

    app.get('/api/modules/service-desk/boards/:boardId/telegram', async (
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
        if (board.type !== 'service_desk') {
            const err: any = new Error('Board is not a Service Desk board');
            err.statusCode = 400;
            throw err;
        }
        await ensureEntitled(prisma, board.workspaceId);

        const integration = await getServiceDeskTelegramIntegration(prisma, boardId, board.workspaceId);
        return {
            configured: !!integration?.botTokenEncrypted && !!integration?.chatId,
            chatId: integration?.chatId ?? null,
            hasBotToken: !!integration?.botTokenEncrypted,
            source: integration?.source ?? 'none',
        };
    });

    app.put('/api/modules/service-desk/boards/:boardId/telegram', async (
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
        if (board.type !== 'service_desk') {
            const err: any = new Error('Board is not a Service Desk board');
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

    app.put('/api/modules/service-desk/workspaces/:workspaceId/telegram', async (
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

    app.get('/api/modules/service-desk/workspaces/:workspaceId/telegram', async (
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
