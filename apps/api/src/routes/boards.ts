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

const DEFAULT_LABELS = [
    { name: 'High Priority', color: '#EB5A46' },
    { name: 'Blocked', color: '#C377E0' },
    { name: 'Bug', color: '#F2D600' },
    { name: 'Feature', color: '#61BD4F' },
];

import { NotificationService } from '../services/notification-service.js';
import { emitToBoard } from '../socket.js';
import { EmailService } from '../services/email.js';
import { ensureBoardAccess } from '../utils/permissions.js';
import { enforceCorePlanBoardLimit, enforceCorePlanMemberLimit } from '../utils/core-plan.js';
import { mid } from '../utils/rank.js';

export async function registerBoardRoutes(app: FastifyInstance, prisma: PrismaClient) {
    const uniqueBoardName = async (workspaceId: string, baseName: string) => {
        const existing = await prisma.board.findMany({
            where: { workspaceId },
            select: { name: true },
        });
        const names = new Set(existing.map(b => b.name.toLowerCase()));
        if (!names.has(baseName.toLowerCase())) return baseName;
        let counter = 2;
        let next = `${baseName} (${counter})`;
        while (names.has(next.toLowerCase())) {
            counter++;
            next = `${baseName} (${counter})`;
        }
        return next;
    };

    const parseRisk = (val: any): 'low' | 'medium' | 'high' | undefined => {
        if (!val) return undefined;
        const norm = String(val).toLowerCase();
        if (norm === 'low' || norm === 'medium' || norm === 'high') return norm;
        return undefined;
    };

    const parseEstimate = (val: any): number | undefined => {
        if (val === null || val === undefined || val === '') return undefined;
        if (typeof val === 'number' && Number.isFinite(val)) return val;
        const raw = String(val).trim().toLowerCase();
        if (!raw) return undefined;
        const num = parseFloat(raw);
        if (!Number.isFinite(num)) return undefined;
        if (raw.endsWith('m')) return num / 60;
        if (raw.endsWith('h')) return num;
        return num;
    };

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

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { workspaceId: true },
        });
        if (!board) return reply.code(404).send({ error: 'Board not found' });
        await enforceCorePlanMemberLimit(prisma, board.workspaceId);

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
    app.post('/api/boards', async (req: FastifyRequest<{ Body: CreateBoardBody }>, reply) => {
        const { workspaceId, name, description } = req.body;
        if (!workspaceId || !name?.trim()) {
            return reply.code(400).send({ error: 'workspaceId and name required' });
        }
        await enforceCorePlanBoardLimit(prisma, workspaceId);
        return prisma.board.create({ data: { workspaceId, name: name.trim(), description } });
    });

    // Export board as JSON
    app.get('/api/boards/:boardId/export', async (
        req: FastifyRequest<{ Params: { boardId: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { boardId } = req.params;

        await ensureBoardAccess(prisma, boardId, user.id);

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: {
                id: true,
                name: true,
                description: true,
                background: true,
                visibility: true,
                workspaceId: true,
            },
        });
        if (!board) return reply.code(404).send({ error: 'Board not found' });

        const [boardMember, workspaceMember] = await Promise.all([
            prisma.boardMember.findUnique({
                where: { userId_boardId: { userId: user.id, boardId } },
                select: { role: true },
            }),
            prisma.workspaceMember.findUnique({
                where: { userId_workspaceId: { userId: user.id, workspaceId: board.workspaceId } },
                select: { role: true },
            }),
        ]);

        const isBoardAdmin = boardMember?.role === 'owner' || boardMember?.role === 'admin';
        if (!isBoardAdmin) {
            return reply.code(403).send({ error: 'Only board owners or admins can export boards' });
        }

        const labels = await prisma.label.findMany({
            where: { boardId },
            orderBy: { rank: 'asc' },
            select: { name: true, color: true, rank: true, isArchived: true },
        });

        const lists = await prisma.list.findMany({
            where: { boardId },
            orderBy: { rank: 'asc' },
            select: {
                name: true,
                rank: true,
                isArchived: true,
                cards: {
                    orderBy: { rank: 'asc' },
                    select: {
                        title: true,
                        description: true,
                        rank: true,
                        priority: true,
                        risk: true,
                        estimate: true,
                        startDate: true,
                        dueDate: true,
                        isArchived: true,
                        isDone: true,
                        labels: { select: { label: { select: { name: true } } } },
                        checklists: {
                            orderBy: { position: 'asc' },
                            select: {
                                title: true,
                                position: true,
                                items: {
                                    orderBy: { position: 'asc' },
                                    select: { text: true, done: true, position: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            board: {
                name: board.name,
                description: board.description,
                background: board.background,
                visibility: board.visibility,
            },
            labels,
            lists: lists.map(l => ({
                name: l.name,
                rank: l.rank,
                isArchived: l.isArchived,
                cards: l.cards.map(c => ({
                    title: c.title,
                    description: c.description,
                    rank: c.rank,
                    priority: c.priority,
                    risk: c.risk,
                    estimate: c.estimate,
                    startDate: c.startDate,
                    dueDate: c.dueDate,
                    isArchived: c.isArchived,
                    isDone: c.isDone,
                    labels: c.labels.map(x => x.label.name),
                    checklists: c.checklists.map(cl => ({
                        title: cl.title,
                        position: cl.position,
                        items: cl.items.map(it => ({
                            text: it.text,
                            done: it.done,
                            position: it.position,
                        })),
                    })),
                })),
            })),
        };
    });

    // Import board from JSON
    app.post('/api/boards/import', async (
        req: FastifyRequest<{
            Body: {
                workspaceId: string;
                board?: { name?: string; description?: string | null; background?: string | null; visibility?: 'private' | 'workspace' | 'public' };
                labels?: { name: string; color: string; rank?: string; isArchived?: boolean }[];
                lists?: Array<{
                    name: string;
                    rank?: string;
                    isArchived?: boolean;
                    cards?: Array<{
                        title: string;
                        description?: string | null;
                        rank?: string;
                        priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
                        risk?: 'low' | 'medium' | 'high' | null;
                        estimate?: number | null;
                        startDate?: string | null;
                        dueDate?: string | null;
                        isArchived?: boolean;
                        isDone?: boolean;
                        labels?: string[];
                        labelNames?: string[];
                        checklists?: { title: string; items: { text: string; done?: boolean }[] }[];
                    }>;
                }>;
            }
        }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { workspaceId, board, labels, lists } = req.body ?? ({} as any);
        if (!workspaceId) return reply.code(400).send({ error: 'workspaceId required' });

        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId } },
            include: { workspace: true },
        });
        if (!member) return reply.code(403).send({ error: 'Forbidden' });
        const isWorkspaceAdmin = member.role === 'owner' || member.role === 'admin';
        if (!isWorkspaceAdmin) {
            return reply.code(403).send({ error: 'Only admins can import boards' });
        }

        await enforceCorePlanBoardLimit(prisma, workspaceId);

        const baseName = board?.name?.trim() || 'Imported Board';
        const name = await uniqueBoardName(workspaceId, baseName);

        const createdBoard = await prisma.board.create({
            data: {
                workspaceId,
                name,
                description: board?.description ?? null,
                background: board?.background ?? null,
                visibility: board?.visibility ?? member.workspace.defaultBoardVisibility ?? 'workspace',
            },
            select: { id: true, name: true, workspaceId: true, description: true, background: true, visibility: true },
        });

        await prisma.boardMember.upsert({
            where: { userId_boardId: { userId: user.id, boardId: createdBoard.id } },
            update: {},
            create: { userId: user.id, boardId: createdBoard.id, role: 'owner' },
        });

        const labelSeeds = Array.isArray(labels) && labels.length > 0 ? labels : DEFAULT_LABELS;
        let prevLabelRank: string | null = null;
        const labelData = labelSeeds.map(l => {
            prevLabelRank = l.rank ?? mid(prevLabelRank);
            return {
                boardId: createdBoard.id,
                name: l.name,
                color: l.color,
                rank: prevLabelRank || undefined,
                isArchived: l.isArchived ?? false,
            };
        });
        await prisma.label.createMany({ data: labelData, skipDuplicates: true });

        const createdLabels = await prisma.label.findMany({
            where: { boardId: createdBoard.id },
            select: { id: true, name: true },
        });
        const labelIdByName = new Map(createdLabels.map(l => [l.name, l.id]));

        const listPayload = Array.isArray(lists) ? lists : [];
        let prevListRank: string | null = null;
        for (const list of listPayload) {
            const listName = (list as any).name ?? (list as any).title ?? 'Untitled';
            prevListRank = list.rank ?? mid(prevListRank);
            const createdList = await prisma.list.create({
                data: {
                    boardId: createdBoard.id,
                    name: listName,
                    rank: prevListRank,
                    isArchived: list.isArchived ?? false,
                },
            });

            const cards = Array.isArray(list.cards) ? list.cards : [];
            let prevCardRank: string | null = null;
            for (const card of cards) {
                const cardTitle = (card as any).title ?? 'Untitled card';
                prevCardRank = card.rank ?? mid(prevCardRank);
                const createdCard = await prisma.card.create({
                    data: {
                        listId: createdList.id,
                        title: cardTitle,
                        description: card.description ?? null,
                        rank: prevCardRank,
                        priority: card.priority ?? undefined,
                        risk: parseRisk(card.risk),
                        estimate: parseEstimate(card.estimate),
                        startDate: card.startDate ? new Date(card.startDate) : undefined,
                        dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
                        isArchived: card.isArchived ?? false,
                        isDone: card.isDone ?? false,
                    },
                });

                const labelNames = card.labels ?? card.labelNames ?? [];
                if (labelNames.length) {
                    const labelIds = labelNames
                        .map(name => labelIdByName.get(name))
                        .filter((id): id is string => Boolean(id));
                    if (labelIds.length) {
                        await prisma.cardLabel.createMany({
                            data: labelIds.map(labelId => ({ cardId: createdCard.id, labelId })),
                            skipDuplicates: true,
                        });
                    }
                }

                if (card.checklists?.length) {
                    for (let i = 0; i < card.checklists.length; i++) {
                        const checklist = card.checklists[i];
                        const createdChecklist = await prisma.checklist.create({
                            data: {
                                cardId: createdCard.id,
                                title: checklist.title,
                                position: i,
                            },
                        });
                        const items = Array.isArray(checklist.items) ? checklist.items : [];
                        for (let j = 0; j < items.length; j++) {
                            const item = items[j];
                            await prisma.checklistItem.create({
                                data: {
                                    checklistId: createdChecklist.id,
                                    text: typeof item === 'string' ? item : item.text,
                                    done: typeof item === 'string' ? false : (item.done ?? false),
                                    position: j,
                                },
                            });
                        }
                    }
                }
            }
        }

        return createdBoard;
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
    }>('/api/boards/:boardId/members', async (req, reply) => {
        const user = ensureUser(req);
        const { boardId } = req.params;
        const { email, role } = req.body;

        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { id: true, name: true, workspaceId: true, workspace: true },
        });
        if (!board) return reply.code(404).send({ error: 'Board not found' });

        // TODO auth: ensure caller can add board members

        const targetUser = await prisma.user.findUnique({ where: { email } });

        // If user not found, create pending invitation
        if (!targetUser) {
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

            await enforceCorePlanMemberLimit(prisma, board.workspaceId);

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

        await enforceCorePlanMemberLimit(prisma, board.workspaceId);

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
    }>('/api/boards/:boardId/members/:userId', async (req, reply) => {
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
