// apps/api/src/routes/labels.routes.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';

type BoardParams = { boardId: string };
type LabelBody = { name: string; color: string };
type UpdateLabelBody = Partial<LabelBody>;
type LabelParams = { id: string };

export async function registerLabelRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // Board labels
    app.get('/api/boards/:boardId/labels', (req: FastifyRequest<{ Params: BoardParams }>) => {
        const { boardId } = req.params;
        return prisma.label.findMany({ where: { boardId }, orderBy: { name: 'asc' } });
    });

    app.post('/api/boards/:boardId/labels', (req: FastifyRequest<{ Params: BoardParams; Body: LabelBody }>) => {
        const { boardId } = req.params; const { name, color } = req.body;
        return prisma.label.create({ data: { boardId, name, color } });
    });

    app.patch('/api/labels/:id', (req: FastifyRequest<{ Params: LabelParams; Body: UpdateLabelBody }>) => {
        const { id } = req.params; const data = req.body;
        return prisma.label.update({ where: { id }, data });
    });

    app.delete('/api/labels/:id', (req: FastifyRequest<{ Params: LabelParams }>) => {
        const { id } = req.params;
        return prisma.label.delete({ where: { id } });
    });

    // ---- Card ↔ label (BOTH forms supported) ----

    // Idempotent path-param style
    app.post('/api/cards/:cardId/labels/:labelId', async (req) => {
        const { cardId, labelId } = req.params as any;
        await prisma.cardLabel.upsert({
            where: { cardId_labelId: { cardId, labelId } },
            update: {},
            create: { cardId, labelId },
        });
        return { ok: true };
    });

    // Body style  (THIS is the one your UI called)
    app.post('/api/cards/:cardId/labels', async (req, res) => {
        const { cardId } = req.params as any;
        const { labelId } = (req.body ?? {}) as { labelId?: string };
        if (!labelId) return res.status(400).send({ error: 'labelId required' });

        await prisma.cardLabel.upsert({
            where: { cardId_labelId: { cardId, labelId } },
            update: {},
            create: { cardId, labelId },
        });

        return res.send({ ok: true });
    });

    app.delete('/api/cards/:cardId/labels/:labelId', async (req) => {
        const { cardId, labelId } = req.params as any;
        await prisma.cardLabel.delete({
            where: { cardId_labelId: { cardId, labelId } },
        }).catch(() => {});
        return { ok: true };
    });
}
