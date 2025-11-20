import type { FastifyInstance, FastifyRequest } from 'fastify';
import {PrismaClient, Role} from '@prisma/client';
import {ensureUser} from "../utils/ensure-user.js";

const DEFAULT_LABELS = [
    { name: 'green',  color: '#61BD4F' },
    { name: 'yellow', color: '#F2D600' },
    { name: 'orange', color: '#FF9F1A' },
    { name: 'red',    color: '#EB5A46' },
    { name: 'purple', color: '#C377E0' },
    { name: 'blue',   color: '#0079BF' },
    { name: 'pink',   color: '#FF78CB' },
    { name: 'lime',   color: '#51E898' },
    { name: 'sky',    color: '#00C2E0' },
    { name: 'black',  color: '#344563' },
] as const;

const DEFAULT_LISTS = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
const rankOf = (i: number) => 'n'.repeat(i + 1); // simple lexorank seed

export async function registerWorkspaceRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // minimal list of workspaces (in real app filter by current user)
    app.get('/api/workspaces', async () => {
        return prisma.workspace.findMany({ select: { id: true, name: true } });
    });

    // POST /api/workspaces/:workspaceId/boards
    app.post('/api/workspaces/:workspaceId/boards', async (
        req: FastifyRequest<{ Params: { workspaceId: string }, Body: {
                name: string;
                description?: string | null;
                background?: string | null;
                // visibility?: 'private' | 'workspace' | 'public' // not in schema (yet)
            } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        const { name, description, background } = req.body ?? ({} as any);
        if (!name?.trim()) return reply.code(400).send({ error: 'name required' });

        // 1) create the board
        const board = await prisma.board.create({
            data: {
                name: name.trim(),
                description: description ?? null,
                background: background ?? null,
                workspaceId,
            },
            select: { id: true, name: true, workspaceId: true, description: true, background: true, createdAt: true },
        });

        // 2) ensure the creator becomes a member (owner/admin)
        await prisma.boardMember.upsert({
            where: { userId_boardId: { userId: user.id, boardId: board.id } },
            update: {},
            create: { userId: user.id, boardId: board.id, role: 'owner' },
        });

        // 3) seed default lists so UI has something to show
        await prisma.list.createMany({
            data: DEFAULT_LISTS.map((title, i) => ({
                boardId: board.id,
                name: title,
                rank: rankOf(i),
            })),
        });

        // 4) seed default labels so the Labels panel isn’t empty
        await prisma.label.createMany({
            data: DEFAULT_LABELS.map(l => ({ boardId: board.id, name: l.name, color: l.color })),
            skipDuplicates: true,
        });

        return board;
    });

    // GET /workspaces/:workspaceId/members?query=...
    app.get<{
        Params: { workspaceId: string },
        Querystring: { query?: string }
    }>('/api/workspaces/:workspaceId/members', async (req, reply) => {
        const { workspaceId } = req.params;
        const q = (req.query.query || '').trim();

        // ✅ Prisma relation filter must use `is: { ... }`
        const where = q
            ? {
                workspaceId,
                user: {
                    is: {
                        OR: [
                            { name:  { contains: q, mode: 'insensitive' } },
                            { email: { contains: q, mode: 'insensitive' } },
                        ],
                    },
                },
            }
            : { workspaceId, user: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } as any };

        const rows = await prisma.workspaceMember.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, avatar: true, email: true } },
            },
            orderBy: [{ role: 'asc' }, { id: 'asc' }],
        });

        const members = rows.map(r => ({
            id: r.user.id,
            name: r.user.name ?? '',
            avatar: r.user.avatar ?? '',
            role: r.role,
        }));

        return reply.send({ members });
    });

    // PATCH /workspaces/:workspaceId/members/:userId  { role: 'owner'|'admin'|'member'|'viewer' }
    app.patch<{
        Params: { workspaceId: string, userId: string },
        Body: { role: Role }
    }>('/workspaces/:workspaceId/members/:userId', async (req, reply) => {
        const { workspaceId, userId } = req.params;
        const { role } = req.body;

        // TODO auth: ensure caller can change roles in this workspace

        await prisma.workspaceMember.update({
            where: { userId_workspaceId: { userId, workspaceId } },
            data: { role },
        });

        return reply.send({ ok: true });
    });
}
