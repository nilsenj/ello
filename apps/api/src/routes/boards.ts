// apps/api/src/routes/boards.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';

type CreateBoardBody = { workspaceId: string; name: string; description?: string };
type ReorderListsBody = { listIds: string[] };

const STEP = 10;
const PAD  = 6;
const pad = (n: number) => n.toString().padStart(PAD, '0');

export async function registerBoardRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // List boards
    app.get('/api/boards', () =>
        prisma.board.findMany({ orderBy: { createdAt: 'desc' } })
    );

    // Get board by id (optionally include ordered lists)
    app.get('/api/boards/:id', (req: FastifyRequest<{ Params: { id: string } }>) => {
        const { id } = req.params;
        return prisma.board.findUnique({
            where: { id },
            include: {
                // return lists in rank order so UI renders correctly
                lists: { orderBy: { rank: 'asc' } },
                labels: true
            }
        });
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

    // 🔥 Reorder all lists in a board
    app.post('/api/boards/:boardId/lists/reorder', async (
        req: FastifyRequest<{ Params: { boardId: string }, Body: ReorderListsBody }>
        , reply) => {
        const { boardId } = req.params;
        const { listIds } = req.body ?? {};

        // basic validation
        if (!Array.isArray(listIds) || listIds.length === 0) {
            return reply.code(400).send({ error: 'listIds must be a non-empty array' });
        }

        // read existing lists for the board
        const existing = await prisma.list.findMany({
            where: { boardId },
            select: { id: true }
        });

        // completeness check
        if (existing.length !== listIds.length) {
            return reply.code(400).send({ error: 'listIds must include every list in the board (no more, no less)' });
        }

        // membership check
        const set = new Set(existing.map(x => x.id));
        for (const id of listIds) {
            if (!set.has(id)) {
                return reply.code(400).send({ error: `List ${id} does not belong to board ${boardId}` });
            }
        }

        // transactional rank rewrite: "000010", "000020", ...
        await prisma.$transaction(
            listIds.map((id, i) =>
                prisma.list.update({
                    where: { id },
                    data: { rank: pad((i + 1) * STEP) }
                })
            )
        );

        return reply.code(204).send();
    });

    // List board members (id, name, avatar) for side panel
    app.get('/api/boards/:id/members', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const { id } = req.params;

        const rows = await prisma.boardMember.findMany({
            where: { boardId: id },
            include: { user: { select: { id: true, name: true, avatar: true } } },
            orderBy: { role: 'asc' },
        });

        return rows.map(r => ({ id: r.user.id, name: r.user.name ?? 'User', avatar: r.user.avatar ?? undefined }));
    });
}
