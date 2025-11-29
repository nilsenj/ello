// apps/api/src/routes/labels.routes.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ensureUser } from "../utils/ensure-user.js";
import { ensureBoardAccess } from "../utils/permissions.js";

type BoardParams = { boardId: string };
type LabelBody = { name: string; color: string };
type UpdateLabelBody = Partial<LabelBody>;
type LabelParams = { id: string };

export async function registerLabelRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // Board labels
    // GET /api/boards/:boardId/labels
    app.get('/api/boards/:boardId/labels', async (req: FastifyRequest<{ Params: { boardId: string } }>, reply) => {
        const user = ensureUser(req);
        const { boardId } = req.params;

        await ensureBoardAccess(prisma, boardId, user.id);

        const labels = await prisma.label.findMany({ where: { boardId }, orderBy: { name: 'asc' } });
        return reply.send(labels);
    });

    app.post('/api/boards/:boardId/labels', async (req: FastifyRequest<{ Params: BoardParams; Body: LabelBody }>) => {
        const user = ensureUser(req);
        const { boardId } = req.params; const { name, color } = req.body;
        await ensureBoardAccess(prisma, boardId, user.id);
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
