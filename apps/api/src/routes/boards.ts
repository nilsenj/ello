// apps/api/src/routes/boards.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';

type CreateBoardBody = { workspaceId: string; name: string; description?: string };

export async function registerBoardRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // List boards
    app.get('/api/boards', () =>
        prisma.board.findMany({ orderBy: { createdAt: 'desc' } })
    );

    // Get board by id
    app.get('/api/boards/:id', (req: FastifyRequest<{ Params: { id: string } }>) => {
        const { id } = req.params;
        return prisma.board.findUnique({ where: { id } });
    });

    // Create board
    app.post('/api/boards', async (req: FastifyRequest<{ Body: CreateBoardBody }>) => {
        const { workspaceId, name, description } = req.body;
        return prisma.board.create({ data: { workspaceId, name, description } });
    });

    // Update board
    app.patch('/api/boards/:id', async (
        req: FastifyRequest<{ Params: { id: string }, Body: Partial<CreateBoardBody> }>
    ) => {
        const { id } = req.params;
        const data = req.body;
        return prisma.board.update({ where: { id }, data });
    });
}
