// apps/api/src/routes/lists.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { mid } from '../utils/rank.js';
import { ensureUser } from "../utils/ensure-user.js";

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
        req: FastifyRequest<{ Params: { boardId: string }, Body: { name?: string; title?: string } }>
    ) => {
        const user = ensureUser(req);
        const { boardId } = req.params;

        await ensureBoardAccess(prisma, boardId, user.id);

        const nameOrTitle = req.body?.title ?? req.body?.name ?? 'Untitled';
        const last = await prisma.list.findFirst({ where: { boardId }, orderBy: { rank: 'desc' }, select: { rank: true } });

        return prisma.list.create({ data: { boardId, name: nameOrTitle, rank: mid(last?.rank) } });
    });

    app.patch('/api/lists/:id', async (
        req: FastifyRequest<{ Params: { id: string }, Body: { name?: string; title?: string; isArchived?: boolean } }>
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const bId = await boardIdByList(prisma, id);
        if (!bId) throw new Error('List not found');
        await ensureBoardAccess(prisma, bId, user.id);

        const title = req.body?.title ?? req.body?.name;
        const { isArchived } = req.body ?? {};

        return prisma.list.update({
            where: { id },
            data: {
                name: title || undefined,
                isArchived: typeof isArchived === 'boolean' ? isArchived : undefined
            }
        });
    });
}