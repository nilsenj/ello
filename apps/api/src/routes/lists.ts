// apps/api/src/routes/lists.ts
import type {FastifyInstance, FastifyRequest} from 'fastify';
import {PrismaClient} from '@prisma/client';
import {mid} from "../rank.js";

export async function registerListRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // Get lists of a board (with cards)
    app.get('/api/boards/:boardId/lists', async (req: FastifyRequest<{ Params: { boardId: string } }>) => {
        const {boardId} = req.params;
        const lists = await prisma.list.findMany({
            where: {boardId},
            orderBy: {rank: 'asc'},
            include: {
                cards: {
                    orderBy: {rank: 'asc'},
                    include: {
                        // This returns CardLabel rows: { cardId, labelId }
                        labels: {select: {labelId: true}},
                    },
                },
            }
        });

        // Normalize -> each card gets labelIds: string[]
        const shaped = lists.map(l => ({
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
                // key line:
                labelIds: (c.labels ?? []).map(x => x.labelId),
            })),
        }));

        return shaped;
    });

    // Create list
    app.post('/api/boards/:boardId/lists', async (
        req: FastifyRequest<{ Params: { boardId: string }, Body: { name?: string; title?: string } }>
    ) => {
        const {boardId} = req.params;
        const nameOrTitle = req.body?.title ?? req.body?.name ?? 'Untitled';
        const last = await prisma.list.findFirst({
            where: {boardId},
            orderBy: {rank: 'desc'},
            select: {rank: true},
        });
        return prisma.list.create({
            data: {boardId, name: nameOrTitle, rank: mid(last?.rank)},
        });
    });

    // Patch list
    app.patch('/api/lists/:id', async (
        req: FastifyRequest<{ Params: { id: string }, Body: { name?: string; title?: string } }>
    ) => {
        const {id} = req.params;
        const title = req.body?.title ?? req.body?.name;
        return prisma.list.update({where: {id}, data: {name: title || undefined}});
    });
}
