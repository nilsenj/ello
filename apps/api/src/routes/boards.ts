// apps/api/src/routes/boards.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient, Role } from '@prisma/client';
import { ensureUser } from "../utils/ensure-user.js";
import { Prisma } from "@prisma/client/extension";

type CreateBoardBody = { workspaceId: string; name: string; description?: string };
type ReorderListsBody = { listIds: string[] };

const STEP = 10;
const PAD = 6;
const pad = (n: number) => n.toString().padStart(PAD, '0');

import { NotificationService } from '../services/notification-service.js';
import { emitToBoard } from '../socket.js';
import { EmailService } from '../services/email.js';

export async function registerBoardRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // List boards (member of board OR member of workspace AND visible)
    app.get('/api/boards', (req) => {
        const user = ensureUser(req);
        return prisma.board.findMany({
            where: {
                OR: [
                    // 1. Direct board membership
                    { members: { some: { userId: user.id } } },
                    // 2. Visible to workspace (and user is member)
                    {
                        visibility: 'workspace',
                        workspace: { members: { some: { userId: user.id } } }
                    },
                    // 3. User is Workspace Admin/Owner (can see everything in their workspaces)
                    {
                        workspace: {
                            members: {
                                some: {
                                    userId: user.id,
                                    role: { in: ['owner', 'admin'] }
                                }
                            }
                        }
                    }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });
    });

    // Get board by id (optionally include ordered lists)
    app.get('/api/boards/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const user = ensureUser(req);
        const { id } = req.params;

        // 1. Fetch board data (clean, without partial members)
        const board = await prisma.board.findUnique({
            where: { id },
            include: {
                lists: { orderBy: { rank: 'asc' } },
                labels: true
            }
        });

        if (!board) return reply.code(404).send({ error: 'Board not found' });

        // 2. Check permissions
        const [boardMember, workspaceMember] = await Promise.all([
            prisma.boardMember.findUnique({
                where: { userId_boardId: { userId: user.id, boardId: id } },
                select: { role: true }
            }),
            prisma.workspaceMember.findUnique({
                where: { userId_workspaceId: { userId: user.id, workspaceId: board.workspaceId } },
                select: { role: true }
            })
        ]);

        const isBoardMember = !!boardMember;
        const isWorkspaceMember = !!workspaceMember;
        const isWorkspaceAdmin = workspaceMember?.role === 'owner' || workspaceMember?.role === 'admin';

        // Permission Check
        if (board.visibility === 'public') {
            // Allow access
        } else if (isWorkspaceAdmin) {
            // Allow access to workspace admins/owners
        } else if (board.visibility === 'workspace') {
            if (!isWorkspaceMember && !isBoardMember) {
                return reply.code(403).send({ error: 'Forbidden: Workspace members only' });
            }
        } else {
            // Private (default)
            if (!isBoardMember) {
                return reply.code(403).send({ error: 'Forbidden: Board members only' });
            }
        }

        return board;
    });

    app.post('/api/boards/:id/join', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const user = ensureUser(req);
        const { id: boardId } = req.params;

        // You may also check workspace membership here if you want to restrict who can join.
        // For now, just upsert a member row.
        await prisma.boardMember.upsert({
            where: { userId_boardId: { userId: user.id, boardId } },
            update: {},
            create: { userId: user.id, boardId, role: 'member' },
        });

        return reply.send({ ok: true });
    });

    // Create board
    app.post('/api/boards', async (req: FastifyRequest<{ Body: CreateBoardBody }>) => {
        const { workspaceId, name, description } = req.body;
        return prisma.board.create({ data: { workspaceId, name, description } });
    });

    // Update board
    app.patch('/api/boards/:id', async (
        req: FastifyRequest<{ Params: { id: string }, Body: Partial<CreateBoardBody> }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;
        const data = req.body;

        // Check permissions
        const [boardMember, workspaceMember] = await Promise.all([
            prisma.boardMember.findUnique({
                where: { userId_boardId: { userId: user.id, boardId: id } }
            }),
            prisma.board.findUnique({
                where: { id },
                select: { workspace: { select: { members: { where: { userId: user.id } } } } }
            })
        ]);

        const isBoardAdmin = boardMember && (boardMember.role === 'owner' || boardMember.role === 'admin');

        // Check if user is workspace admin/owner
        const workspaceRole = workspaceMember?.workspace.members[0]?.role;
        const isWorkspaceAdmin = workspaceRole === 'owner' || workspaceRole === 'admin';

        if (!isBoardAdmin && !isWorkspaceAdmin) {
            return reply.code(403).send({ error: 'Only admins can update board settings' });
        }

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

    // GET /boards/:boardId/members?query=...
    app.get<{
        Params: { boardId: string };
        Querystring: { query?: string };
    }>('/api/boards/:boardId/members', async (req, reply) => {
        ensureUser(req);

        const { boardId } = req.params;
        const q = (req.query.query ?? '').trim();

        // Build where safely. Only add the user filter when q is present.
        const where: any = {
            boardId,
            ...(q
                ? {
                    user: {
                        is: {
                            OR: [
                                { name: { contains: q, mode: 'insensitive' } },
                                { email: { contains: q, mode: 'insensitive' } },
                            ],
                        },
                    },
                }
                : {}),
        };

        const [rows, pending] = await Promise.all([
            prisma.boardMember.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, avatar: true, email: true } },
                },
                orderBy: [{ role: 'asc' }, { id: 'asc' }],
                take: q ? 20 : 100, // limit results
            }),
            prisma.pendingInvitation.findMany({
                where: {
                    boardId,
                    ...(q ? { email: { contains: q, mode: 'insensitive' } } : {})
                }
            })
        ]);

        const members = [
            ...rows.map((r) => ({
                id: r.user.id,
                name: r.user.name ?? r.user.email,
                email: r.user.email,
                avatar: r.user.avatar ?? undefined,
                role: r.role,
                status: 'active'
            })),
            ...pending.map(p => ({
                id: p.id, // Use invitation ID as temporary ID
                name: p.email, // Use email as name
                email: p.email,
                avatar: undefined,
                role: p.role,
                status: 'pending'
            }))
        ];

        return reply.send({ members });
    });

    // POST /boards/:boardId/members  { email: string, role: Role }
    app.post<{
        Params: { boardId: string },
        Body: { email: string, role: Role }
    }>('/boards/:boardId/members', async (req, reply) => {
        const user = ensureUser(req);
        const { boardId } = req.params;
        const { email, role } = req.body;

        // TODO auth: ensure caller can add board members

        const targetUser = await prisma.user.findUnique({ where: { email } });

        // If user not found, create pending invitation
        if (!targetUser) {
            const board = await prisma.board.findUnique({
                where: { id: boardId },
                include: { workspace: true }
            });
            if (!board) return reply.code(404).send({ error: 'Board not found' });

            // Check if already invited
            const existing = await prisma.pendingInvitation.findFirst({
                where: {
                    workspaceId: board.workspaceId,
                    email,
                    boardId // Only match if invited to this specific board
                }
            });

            if (existing) {
                return reply.code(400).send({ error: 'User already invited to this board' });
            }

            await prisma.pendingInvitation.create({
                data: {
                    email,
                    workspaceId: board.workspaceId,
                    inviterId: user.id,
                    role: role || 'member',
                    boardId
                }
            });

            const inviter = await prisma.user.findUnique({ where: { id: user.id } });

            // Send email (background)
            setTimeout(() => {
                EmailService.sendBoardInvitationEmail(
                    email,
                    board.name,
                    board.workspace.name,
                    inviter?.name || inviter?.email || 'Someone'
                ).catch(err => console.error('[Req] Failed to send board invitation email (background):', err));
            }, 0);

            return reply.send({ status: 'pending', email });
        }

        // Check if already a member
        const existingMember = await prisma.boardMember.findUnique({
            where: { userId_boardId: { userId: targetUser.id, boardId } }
        });
        if (existingMember) {
            return reply.code(400).send({ error: 'User is already a member of this board' });
        }

        const member = await prisma.boardMember.create({
            data: {
                boardId,
                userId: targetUser.id,
                role: role || 'member'
            }
        });

        // Trigger notification
        const notificationService = new NotificationService(prisma);
        notificationService.notifyBoardInvite({
            userId: targetUser.id,
            actorId: user.id,
            boardId
        }).catch(console.error);

        return reply.send(member);
    });

    // PATCH /boards/:boardId/members/:userId  { role: 'owner'|'admin'|'member'|'viewer' }
    app.patch<{
        Params: { boardId: string, userId: string },
        Body: { role: Role }
    }>('/boards/:boardId/members/:userId', async (req, reply) => {
        const user = ensureUser(req);
        const { boardId, userId } = req.params;
        const { role } = req.body;

        // TODO auth: ensure caller can change board roles

        await prisma.boardMember.update({
            where: { userId_boardId: { userId, boardId } },
            data: { role },
        });

        return reply.send({ ok: true });
    });

    // PATCH /boards/:id/background  { background: string }
    app.patch<{
        Params: { id: string },
        Body: { background: string }
    }>('/api/boards/:id/background', async (req, reply) => {
        const user = ensureUser(req);
        const { id } = req.params;
        const { background } = req.body;

        // Check permissions
        const member = await prisma.boardMember.findUnique({
            where: { userId_boardId: { userId: user.id, boardId: id } }
        });

        if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
            // Check if workspace admin
            const board = await prisma.board.findUnique({
                where: { id },
                include: { workspace: { include: { members: { where: { userId: user.id } } } } }
            });

            const wsRole = board?.workspace?.members?.[0]?.role;
            const isWsAdmin = wsRole === 'owner' || wsRole === 'admin';

            if (!isWsAdmin) {
                return reply.code(403).send({ error: 'Only admins can update board background' });
            }
        }

        // Validate background value (predefined colors/gradients)
        const validBackgrounds = [
            'blue', 'green', 'red', 'purple', 'orange', 'pink',
            'gradient-blue', 'gradient-green', 'gradient-purple', 'gradient-sunset',
            'gradient-ocean', 'gradient-forest', 'none'
        ];

        if (!validBackgrounds.includes(background) && !background.startsWith('http')) {
            return reply.code(400).send({ error: 'Invalid background value' });
        }

        // Update board background
        const updated = await prisma.board.update({
            where: { id },
            data: { background }
        });

        // Real-time update
        emitToBoard(id, 'board:updated', updated);

        return reply.send(updated);
    });
}
