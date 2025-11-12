import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';

export async function registerWorkspaceRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // minimal list of workspaces (in real app filter by current user)
    app.get('/api/workspaces', async () => {
        return prisma.workspace.findMany({ select: { id: true, name: true } });
    });

    // alias to create a board under a workspace
    app.post('/api/workspaces/:workspaceId/boards', async (
        req: FastifyRequest<{ Params: { workspaceId: string }, Body: { name: string; description?: string } }>
    ) => {
        const { workspaceId } = req.params;
        const { name, description } = req.body ?? ({} as any);
        if (!name) return { error: 'name required' };
        return prisma.board.create({ data: { name, description, workspaceId } });
    });
}
