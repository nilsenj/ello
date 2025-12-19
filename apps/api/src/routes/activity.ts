import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { ensureUser } from '../utils/ensure-user.js';
import { ensureBoardAccess } from '../utils/permissions.js';


export async function registerActivityRoutes(app: FastifyInstance, prisma: PrismaClient) {
    app.get('/api/boards/:boardId/activity', async (req: FastifyRequest<{ Params: { boardId: string }, Querystring: { limit?: number, offset?: number } }>, reply) => {
        const user = ensureUser(req);
        const { boardId } = req.params;
        const { limit = 20, offset = 0 } = req.query || {};

        // Check access via board
        await ensureBoardAccess(prisma, boardId, user.id);


        const activities = await prisma.activity.findMany({
            where: { boardId },
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            skip: Number(offset),
            include: {
                user: { select: { id: true, name: true, avatar: true } },
                card: { select: { id: true, title: true } }
            }
        });

        return activities;
    });

    app.get('/api/cards/:cardId/activity', async (req: FastifyRequest<{ Params: { cardId: string }, Querystring: { limit?: number, offset?: number } }>, reply) => {
        const user = ensureUser(req);
        const { cardId } = req.params;
        const { limit = 20, offset = 0 } = req.query || {};

        // Check access via board
        const card = await prisma.card.findUnique({
            where: { id: cardId },
            select: { list: { select: { boardId: true } } }
        });
        if (!card) return reply.code(404).send({ error: 'Card not found' });

        const boardId = card.list.boardId;
        await ensureBoardAccess(prisma, boardId, user.id);


        const activities = await prisma.activity.findMany({
            where: { cardId },
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            skip: Number(offset),
            include: {
                user: { select: { id: true, name: true, avatar: true } },
                card: { select: { id: true, title: true } }
            }
        });

        return activities;
    });
}
