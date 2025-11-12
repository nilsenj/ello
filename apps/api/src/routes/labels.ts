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
}
