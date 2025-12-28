// apps/api/src/routes/lists.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { mid } from '../utils/rank.js';
import { ensureUser } from "../utils/ensure-user.js";
import { SERVICE_DESK_STATUS_KEYS } from '../utils/service-desk.js';

type JwtPayload = { sub: string; email?: string };

// --- auth & membership helpers ---------------------------------------------



import { ensureBoardAccess } from '../utils/permissions.js';

// Removed local assertBoardMember in favor of shared helper

async function boardIdByList(prisma: PrismaClient, listId: string) {
    const row = await prisma.list.findUnique({
        where: { id: listId },
        select: { boardId: true },
    });
    return row?.boardId ?? null;
}

// ---------------------------------------------------------------------------

export async function registerListRoutes(app: FastifyInstance, prisma: PrismaClient) {
    app.get('/api/boards/:boardId/lists', async (req: FastifyRequest<{ Params: { boardId: string } }>) => {
        const user = ensureUser(req); // ← decode Bearer if needed
        const { boardId } = req.params;

        await ensureBoardAccess(prisma, boardId, user.id);

        const lists = await prisma.list.findMany({
            where: { boardId },
            orderBy: { rank: 'asc' },
            include: {
                cards: {
                    orderBy: { rank: 'asc' },
                    include: {
                        labels: { select: { labelId: true } },
                        assignees: { include: { user: true } },
                        _count: { select: { comments: true, checklists: true } }
                    },
                },
            },
        });

        return lists.map(l => ({
            id: l.id,
            name: l.name,
            title: (l as any).title ?? l.name,
            rank: l.rank,
            boardId: l.boardId,
            isArchived: l.isArchived,
            statusKey: (l as any).statusKey ?? null,
            isSystem: (l as any).isSystem ?? false,
            cards: l.cards.map(c => ({
                id: c.id,
                title: c.title,
                description: c.description,
                listId: c.listId,
                rank: c.rank,
                priority: c.priority,
                isArchived: c.isArchived,
                dueDate: c.dueDate,
                startDate: c.startDate,
                estimate: c.estimate,
                scheduledAt: c.scheduledAt,
                lastStatusChangedAt: c.lastStatusChangedAt,
                customerName: c.customerName,
                customerPhone: c.customerPhone,
                address: c.address,
                serviceType: c.serviceType,
                labelIds: (c.labels ?? []).map(x => x.labelId),
                assignees: c.assignees.map(a => ({
                    userId: a.userId,
                    id: a.userId, // CardMember has no single ID
                    user: a.user ? { id: a.user.id, name: a.user.name, avatar: a.user.avatar } : undefined,
                    role: a.role
                })),
                commentCount: (c as any)._count?.comments ?? 0,
                checklistCount: (c as any)._count?.checklists ?? 0,
            })),
        }));
    });

    app.post('/api/boards/:boardId/lists', async (
        req: FastifyRequest<{ Params: { boardId: string }, Body: { name?: string; title?: string; statusKey?: string } }>
    ) => {
        const user = ensureUser(req);
        const { boardId } = req.params;

        await ensureBoardAccess(prisma, boardId, user.id);

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }

        const nameOrTitle = req.body?.title ?? req.body?.name ?? 'Untitled';
        const last = await prisma.list.findFirst({ where: { boardId }, orderBy: { rank: 'desc' }, select: { rank: true } });
        const statusKey = req.body?.statusKey;
        if (board.type === 'service_desk') {
            if (!statusKey || !SERVICE_DESK_STATUS_KEYS.includes(statusKey as any)) {
                const err: any = new Error('statusKey required for Service Desk lists');
                err.statusCode = 400;
                throw err;
            }
        }

        return prisma.list.create({
            data: {
                boardId,
                name: nameOrTitle,
                rank: mid(last?.rank),
                statusKey: board.type === 'service_desk' ? (statusKey as any) : undefined,
                isSystem: false,
            },
        });
    });

    app.patch('/api/lists/:id', async (
        req: FastifyRequest<{ Params: { id: string }, Body: { name?: string; title?: string; isArchived?: boolean; statusKey?: string } }>
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const list = await prisma.list.findUnique({
            where: { id },
            select: { boardId: true, isSystem: true },
        });
        const bId = list?.boardId;
        if (!bId) throw new Error('List not found');
        await ensureBoardAccess(prisma, bId, user.id);

        const board = await prisma.board.findUnique({
            where: { id: bId },
            select: { type: true },
        });
        if (!board) {
            const err: any = new Error('Board not found');
            err.statusCode = 404;
            throw err;
        }

        const title = req.body?.title ?? req.body?.name;
        const { isArchived } = req.body ?? {};
        const statusKey = req.body?.statusKey;
        if (board.type === 'service_desk' && list?.isSystem && typeof isArchived === 'boolean') {
            const err: any = new Error('System lists cannot be archived');
            err.statusCode = 400;
            throw err;
        }
        if (board.type === 'service_desk' && statusKey && !SERVICE_DESK_STATUS_KEYS.includes(statusKey as any)) {
            const err: any = new Error('Invalid statusKey');
            err.statusCode = 400;
            throw err;
        }
        const allowStatusUpdate = board.type === 'service_desk' && !list?.isSystem && statusKey;

        return prisma.list.update({
            where: { id },
            data: {
                name: title || undefined,
                isArchived: typeof isArchived === 'boolean' ? isArchived : undefined,
                statusKey: allowStatusUpdate ? (statusKey as any) : undefined,
            }
        });
    });
}
