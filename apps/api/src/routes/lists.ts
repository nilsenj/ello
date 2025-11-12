// apps/api/src/routes/lists.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { mid } from '../utils/rank.js';
import {ensureUser} from "../utils/ensure-user.js";

type JwtPayload = { sub: string; email?: string };

// --- auth & membership helpers ---------------------------------------------

function readUserId(req: FastifyRequest): string {
    // Accept: Authorization: Bearer <jwt>
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
        const e: any = new Error('Unauthorized');
        e.statusCode = 401;
        throw e;
    }
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as JwtPayload;
        if (!payload?.sub) throw new Error('no sub');
        // attach for downstream (optional)
        (req as any).user = { id: payload.sub };
        return payload.sub;
    } catch {
        const e: any = new Error('Unauthorized');
        e.statusCode = 401;
        throw e;
    }
}

async function assertBoardMember(prisma: PrismaClient, boardId: string | null, userId: string) {
    if (!boardId) {
        const e: any = new Error('Not Found');
        e.statusCode = 404;
        throw e;
    }
    const member = await prisma.boardMember.findFirst({
        where: { boardId, userId },
        select: { id: true },
    });
    if (!member) {
        const e: any = new Error('Forbidden');
        e.statusCode = 403;
        throw e;
    }
}

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

        await assertBoardMember(prisma, boardId, user.id);

        const lists = await prisma.list.findMany({
            where: { boardId },
            orderBy: { rank: 'asc' },
            include: {
                cards: {
                    orderBy: { rank: 'asc' },
                    include: { labels: { select: { labelId: true } } },
                },
            },
        });

        return lists.map(l => ({
            id: l.id,
            name: l.name,
            title: (l as any).title ?? l.name,
            rank: l.rank,
            boardId: l.boardId,
            cards: l.cards.map(c => ({
                id: c.id,
                title: c.title,
                description: c.description,
                listId: c.listId,
                rank: c.rank,
                priority: c.priority,
                labelIds: (c.labels ?? []).map(x => x.labelId),
            })),
        }));
    });

    app.post('/api/boards/:boardId/lists', async (
        req: FastifyRequest<{ Params: { boardId: string }, Body: { name?: string; title?: string } }>
    ) => {
        const user = ensureUser(req);
        const { boardId } = req.params;

        await assertBoardMember(prisma, boardId, user.id);

        const nameOrTitle = req.body?.title ?? req.body?.name ?? 'Untitled';
        const last = await prisma.list.findFirst({ where: { boardId }, orderBy: { rank: 'desc' }, select: { rank: true } });

        return prisma.list.create({ data: { boardId, name: nameOrTitle, rank: mid(last?.rank) } });
    });

    app.patch('/api/lists/:id', async (
        req: FastifyRequest<{ Params: { id: string }, Body: { name?: string; title?: string } }>
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const bId = await boardIdByList(prisma, id);
        await assertBoardMember(prisma, bId, user.id);

        const title = req.body?.title ?? req.body?.name;
        return prisma.list.update({ where: { id }, data: { name: title || undefined } });
    });
}