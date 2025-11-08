// apps/api/src/routes/cards.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { between } from '../utils/rank.js';

type ListParams = { listId: string };
type CreateCardBody = { title: string; description?: string };
type CardParams = { id: string };
type MoveBody = { beforeId?: string | null; afterId?: string | null; toListId: string };

// helper: shape card → include labelIds
const shapeCard = (c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    listId: c.listId,
    rank: c.rank,
    labelIds: (c.labels ?? []).map((x: any) => x.labelId),
});

export async function registerCardRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // list-scoped: read (RETURN labelIds)
    app.get('/api/lists/:listId/cards', async (req: FastifyRequest<{ Params: ListParams }>) => {
        const { listId } = req.params;
        const cards = await prisma.card.findMany({
            where: { listId },
            orderBy: { rank: 'asc' },
            include: { labels: { select: { labelId: true } } }, // <— include junctions
        });
        return cards.map(shapeCard);
    });

    // ADD: read one card with relations
    app.get('/api/cards/:id', async (req: FastifyRequest<{ Params: CardParams }>) => {
        const { id } = req.params;
        return prisma.card.findUnique({
            where: { id },
            include: {
                labels: true,                     // if you keep a virtual relation
                assignees: { include: { user: true } },
                checklists: { include: { items: true } },
                attachments: true,
                comments: { include: { author: true }, orderBy: { createdAt: 'desc' } },
            },
        });
    });

    // list-scoped: create (RETURN labelIds)
    app.post('/api/lists/:listId/cards', async (req: FastifyRequest<{ Params: ListParams; Body: CreateCardBody }>) => {
        const { listId } = req.params;
        const { title, description } = req.body;

        const before = await prisma.card.findFirst({
            where: { listId },
            orderBy: { rank: 'desc' },
            select: { rank: true },
        });
        const newRank = between(before?.rank ?? null, null); // append

        const created = await prisma.card.create({
            data: { listId, title, description, rank: newRank },
            include: { labels: { select: { labelId: true } } },
        });
        return shapeCard(created);
    });

    // edit (RETURN labelIds)
    app.patch('/api/cards/:id', async (req: FastifyRequest<{ Params: CardParams; Body: Partial<CreateCardBody> }>) => {
        const { id } = req.params;
        const data = req.body;
        const updated = await prisma.card.update({
            where: { id },
            data,
            include: { labels: { select: { labelId: true } } },
        });
        return shapeCard(updated);
    });

    // move/reorder (RETURN labelIds)
    app.post('/api/cards/:id/move', async (req: FastifyRequest<{ Params: CardParams; Body: MoveBody }>) => {
        const { id } = req.params;
        const { toListId, beforeId, afterId } = req.body;

        const before = beforeId
            ? await prisma.card.findUnique({ where: { id: beforeId }, select: { rank: true } })
            : null;

        const after = afterId
            ? await prisma.card.findUnique({ where: { id: afterId }, select: { rank: true } })
            : null;

        const newRank = between(before?.rank ?? null, after?.rank ?? null);

        const moved = await prisma.card.update({
            where: { id },
            data: { listId: toListId, rank: newRank },
            include: { labels: { select: { labelId: true } } },
        });
        return shapeCard(moved);
    });

    app.delete('/api/cards/:id', (req: FastifyRequest<{ Params: CardParams }>) => {
        const { id } = req.params;
        return prisma.card.delete({ where: { id } });
    });

    // ADD: patch extended fields
    type PatchCardBody = Partial<{
        title: string;
        description: string;
        startDate: string | null;
        dueDate: string | null;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        isArchived: boolean;
    }>;

    app.patch('/api/cards/:id/extended', (req: FastifyRequest<{ Params: CardParams; Body: PatchCardBody }>) => {
        const { id } = req.params;
        const { startDate, dueDate, ...rest } = req.body;
        return prisma.card.update({
            where: { id },
            data: {
                ...rest,
                startDate: startDate ? new Date(startDate) : null,
                dueDate:   dueDate ? new Date(dueDate) : null,
            },
        });
    });
}
