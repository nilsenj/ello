import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient, Role } from '@prisma/client';
import { ensureUser } from '../utils/ensure-user.js';
import { mid } from '../utils/rank.js';
import { canCreateBoards, canEditSettings, canInviteMembers, isEmailDomainAllowed } from '../utils/workspace-permissions.js';
import { EmailService } from '../services/email.js';
import { NotificationService } from '../services/notification-service.js';

const DEFAULT_LABELS = [
    { name: 'High Priority', color: '#EB5A46' },
    { name: 'Blocked', color: '#C377E0' },
    { name: 'Bug', color: '#F2D600' },
    { name: 'Feature', color: '#61BD4F' },
];

const DEFAULT_LISTS = ['To Do', 'In Progress', 'Done'];

export async function registerWorkspaceRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // List all workspaces for the authenticated user
    app.get('/api/workspaces', async (req, reply) => {
        const user = ensureUser(req);
        const rows = await prisma.workspaceMember.findMany({
            where: { userId: user.id },
            include: {
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        whoCanCreateBoards: true,
                        whoCanInviteMembers: true,
                    }
                }
            },
        });
        return rows.map(r => ({
            ...r.workspace,
            role: r.role,
        }));
    });

    // Create workspace
    app.post('/api/workspaces', async (req: FastifyRequest<{ Body: { name: string; description?: string } }>, reply) => {
        const user = ensureUser(req);
        const { name, description } = req.body;

        if (!name?.trim()) return reply.code(400).send({ error: 'name required' });

        const existing = await prisma.workspace.findUnique({ where: { name } });
        if (existing) return reply.code(409).send({ error: 'workspace already exists' });

        const workspace = await prisma.workspace.create({
            data: {
                name: name.trim(),
                description: description ?? null,
            },
        });

        await prisma.workspaceMember.create({
            data: {
                workspaceId: workspace.id,
                userId: user.id,
                role: 'owner',
            },
        });

        return workspace;
    });

    // Get workspace settings
    app.get('/api/workspaces/:id/settings', async (
        req: FastifyRequest<{ Params: { id: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;

        // Verify user is a member
        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId: id } },
        });
        if (!member) return reply.code(403).send({ error: 'Forbidden' });

        // Only admins/owners can view settings
        if (member.role !== 'owner' && member.role !== 'admin') {
            return reply.code(403).send({ error: 'Only admins can access settings' });
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                description: true,
                visibility: true,
                whoCanCreateBoards: true,
                whoCanInviteMembers: true,
                allowedEmailDomains: true,
                defaultBoardVisibility: true,
            },
        });

        if (!workspace) return reply.code(404).send({ error: 'Workspace not found' });

        return workspace;
    });

    // Update workspace settings (admins only)
    app.patch('/api/workspaces/:id/settings', async (
        req: FastifyRequest<{
            Params: { id: string };
            Body: {
                visibility?: 'private' | 'public';
                whoCanCreateBoards?: 'admins' | 'members';
                whoCanInviteMembers?: 'admins' | 'members';
                allowedEmailDomains?: string | null;
                defaultBoardVisibility?: 'private' | 'workspace' | 'public';
            };
        }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;

        // Verify user is admin/owner
        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId: id } },
        });
        if (!member || !canEditSettings(member)) {
            return reply.code(403).send({ error: 'Only admins can edit workspace settings' });
        }

        const {
            visibility,
            whoCanCreateBoards,
            whoCanInviteMembers,
            allowedEmailDomains,
            defaultBoardVisibility,
        } = req.body;

        const workspace = await prisma.workspace.update({
            where: { id },
            data: {
                ...(visibility && { visibility }),
                ...(whoCanCreateBoards && { whoCanCreateBoards }),
                ...(whoCanInviteMembers && { whoCanInviteMembers }),
                ...(allowedEmailDomains !== undefined && { allowedEmailDomains }),
                ...(defaultBoardVisibility && { defaultBoardVisibility }),
            },
        });

        return workspace;
    });

    // Update workspace (name/description)
    app.put('/api/workspaces/:id', async (
        req: FastifyRequest<{ Params: { id: string }; Body: { name?: string; description?: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;
        const { name, description } = req.body;

        // Verify admin/owner
        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId: id } },
        });
        if (!member || !canEditSettings(member)) {
            return reply.code(403).send({ error: 'Only admins can edit workspace' });
        }

        const workspace = await prisma.workspace.update({
            where: { id },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description }),
            },
        });
        return workspace;
    });

    // Delete workspace
    app.delete('/api/workspaces/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const user = ensureUser(req);
        const { id } = req.params;

        // Only owners can delete
        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId: id } },
            include: { workspace: true }
        });
        if (!member || member.role !== 'owner') {
            return reply.code(403).send({ error: 'Only owners can delete workspace' });
        }

        if (member.workspace.isPersonal) {
            return reply.code(403).send({ error: 'Cannot delete personal workspace' });
        }

        await prisma.workspace.delete({ where: { id } });
        return { ok: true };
    });

    // Add member to workspace (with permission check and email domain validation)
    app.post('/api/workspaces/:id/members', async (
        req: FastifyRequest<{ Params: { id: string }; Body: { email: string; role?: Role } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { id: workspaceId } = req.params;
        const { email, role = 'member' } = req.body;

        // Verify inviter permissions
        const inviter = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId } },
            include: { workspace: true, user: true },
        });
        if (!inviter) return reply.code(403).send({ error: 'Forbidden' });

        // Check if user can invite members
        if (!canInviteMembers(inviter.workspace, inviter)) {
            return reply.code(403).send({ error: 'You do not have permission to invite members' });
        }

        // Check email domain restrictions
        if (!isEmailDomainAllowed(inviter.workspace, email)) {
            return reply.code(400).send({ error: 'Email domain not allowed for this workspace' });
        }

        const targetUser = await prisma.user.findUnique({ where: { email } });

        if (!targetUser) {
            // User doesn't exist, create pending invitation
            // Use findFirst because there is no unique constraint on [workspaceId, email]
            const existingInvite = await prisma.pendingInvitation.findFirst({
                where: { workspaceId, email }
            });

            if (existingInvite) {
                // Update role if already invited
                const updated = await prisma.pendingInvitation.update({
                    where: { id: existingInvite.id },
                    data: { role: role || 'member' }
                });
                return { ...updated, status: 'pending' };
            }

            const invite = await prisma.pendingInvitation.create({
                data: {
                    workspaceId,
                    email,
                    role: role || 'member',
                    inviterId: user.id
                }
            });

            // Send invitation email
            // Send invitation email (non-blocking)
            // Fire-and-forget so we don't block the response on slow Ethereal connection
            setTimeout(() => {
                EmailService.sendInvitationEmail(
                    email,
                    inviter.workspace.name,
                    inviter.user.name || 'A user'
                ).catch(err => {
                    console.error('[Req] Failed to send invitation email (background):', err);
                });
            }, 0);

            return { ...invite, status: 'pending' };
        }

        // User exists, check if already a member
        const existingMember = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: targetUser.id, workspaceId } }
        });

        if (existingMember) {
            return reply.code(409).send({ error: 'User is already a member of this workspace' });
        }

        const member = await prisma.workspaceMember.create({
            data: {
                workspaceId,
                userId: targetUser.id,
                role
            }
        });

        // Notify the new member via Socket.IO
        const notificationService = new NotificationService(prisma);
        notificationService.notifyWorkspaceInvite({
            userId: targetUser.id,
            actorId: user.id,
            workspaceId
        }).catch(console.error);

        return { ...member, status: 'active' };
    });

    // POST /api/workspaces/:workspaceId/boards
    app.post('/api/workspaces/:workspaceId/boards', async (
        req: FastifyRequest<{
            Params: { workspaceId: string }, Body: {
                name: string;
                description?: string | null;
                background?: string | null;
                lists?: string[];
                labels?: { name: string; color: string }[];
                cards?: {
                    title: string;
                    description?: string | null;
                    list: string;
                    checklists?: { title: string; items: string[] }[];
                    labelNames?: string[];
                }[];
                visibility?: 'private' | 'workspace' | 'public';
            }
        }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;
        const { name, description, background, lists, labels, cards, visibility } = req.body ?? ({} as any);
        if (!name?.trim()) return reply.code(400).send({ error: 'name required' });

        // Check if user can create boards in this workspace
        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId } },
            include: { workspace: true },
        });
        if (!member) return reply.code(403).send({ error: 'Forbidden' });

        if (!canCreateBoards(member.workspace, member)) {
            return reply.code(403).send({ error: 'You do not have permission to create boards in this workspace' });
        }

        // 1) create the board
        const board = await prisma.board.create({
            data: {
                name: name.trim(),
                description: description ?? null,
                background: background ?? null,
                workspaceId,
                visibility: visibility ?? member.workspace.defaultBoardVisibility ?? 'workspace',
            },
            select: { id: true, name: true, workspaceId: true, description: true, background: true, createdAt: true },
        });

        // 2) ensure the creator becomes a member (owner/admin)
        await prisma.boardMember.upsert({
            where: { userId_boardId: { userId: user.id, boardId: board.id } },
            update: {},
            create: { userId: user.id, boardId: board.id, role: 'owner' },
        });

        // 3) seed lists - use template lists if provided, otherwise use defaults
        const listNames = lists && lists.length > 0 ? lists : DEFAULT_LISTS;
        let prevRank: string | null = null;
        const listData = listNames.map((title) => {
            prevRank = mid(prevRank);
            return {
                boardId: board.id,
                name: title,
                rank: prevRank,
            };
        });
        await prisma.list.createMany({ data: listData });

        // 4) seed labels so the Labels panel isn't empty
        const labelSeeds = labels && labels.length > 0 ? labels : DEFAULT_LABELS;
        await prisma.label.createMany({
            data: labelSeeds.map(l => ({ boardId: board.id, name: l.name, color: l.color })),
            skipDuplicates: true,
        });
        const createdLabels = await prisma.label.findMany({
            where: { boardId: board.id },
            select: { id: true, name: true },
        });
        const labelIdByName = new Map(createdLabels.map(l => [l.name, l.id]));

        // 5) seed template cards + checklists (optional)
        if (cards && cards.length > 0) {
            const createdLists = await prisma.list.findMany({
                where: { boardId: board.id },
                select: { id: true, name: true },
            });
            const listIdByName = new Map(createdLists.map(l => [l.name, l.id]));
            const lastRankByList: Record<string, string | null> = {};

            for (const card of cards) {
                const listId = listIdByName.get(card.list);
                if (!listId) continue;

                const prevRank = lastRankByList[listId] ?? null;
                const rank = mid(prevRank);
                lastRankByList[listId] = rank;

                const createdCard = await prisma.card.create({
                    data: {
                        listId,
                        title: card.title,
                        description: card.description ?? null,
                        rank,
                    },
                });

                if (card.labelNames?.length) {
                    const labelIds = card.labelNames
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
                        for (let j = 0; j < checklist.items.length; j++) {
                            await prisma.checklistItem.create({
                                data: {
                                    checklistId: createdChecklist.id,
                                    text: checklist.items[j],
                                    position: j,
                                },
                            });
                        }
                    }
                }
            }
        }

        return board;
    });

    // GET /api/workspaces/:workspaceId/boards - get all boards in a workspace
    app.get('/api/workspaces/:workspaceId/boards', async (
        req: FastifyRequest<{ Params: { workspaceId: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { workspaceId } = req.params;

        // Verify workspace membership
        const member = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId } },
        });
        if (!member) return reply.code(403).send({ error: 'Forbidden' });

        const isWorkspaceAdmin = member.role === 'owner' || member.role === 'admin';

        // Filter: Admin sees all. Others see Public, Workspace, or Board-Member boards.
        const where: any = { workspaceId };
        if (!isWorkspaceAdmin) {
            where.OR = [
                { visibility: 'public' },
                { visibility: 'workspace' },
                { members: { some: { userId: user.id } } }
            ];
        }

        const boards = await prisma.board.findMany({
            where,
            select: { id: true, name: true, background: true, description: true, createdAt: true, visibility: true },
            orderBy: { createdAt: 'desc' }
        });
        return boards;
    });

    // GET /workspaces/:workspaceId/members?query=...
    app.get<{
        Params: { workspaceId: string },
        Querystring: { query?: string }
    }>('/api/workspaces/:workspaceId/members', async (req, reply) => {
        const { workspaceId } = req.params;
        const q = (req.query.query || '').trim();

        // ✅ Prisma relation filter must use `is: { ... }`
        const where: any = q
            ? {
                workspaceId,
                user: {
                    is: {
                        OR: [
                            { name: { contains: q, mode: 'insensitive' } },
                            { email: { contains: q, mode: 'insensitive' } },
                        ],
                    },
                },
            }
            : { workspaceId };

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
            email: r.user.email ?? '',
            avatar: r.user.avatar ?? '',
            role: r.role,
            status: 'active'
        }));

        // Also fetch pending invitations matching the query
        const pendingWhere = q
            ? {
                workspaceId,
                email: { contains: q, mode: 'insensitive' }
            }
            : { workspaceId };

        const pendingRows = await prisma.pendingInvitation.findMany({
            where: pendingWhere as any,
            orderBy: { createdAt: 'desc' }
        });

        const pending = pendingRows.map(p => ({
            id: p.id,
            name: p.email, // Use email as name for pending
            avatar: '',
            role: p.role,
            status: 'pending',
            email: p.email
        }));

        return reply.send({ members: [...members, ...pending] });
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

    // DELETE /workspaces/:workspaceId/members/:memberId
    app.delete<{
        Params: { workspaceId: string, memberId: string }
    }>('/api/workspaces/:workspaceId/members/:memberId', async (req, reply) => {
        const user = ensureUser(req);
        const { workspaceId, memberId } = req.params;

        // 1. Verify requester is admin/owner
        const requester = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId } },
            include: { workspace: true }
        });

        if (!requester) return reply.code(403).send({ error: 'Forbidden' });

        // Allow users to leave (remove themselves)
        const isSelf = memberId === user.id;

        if (!isSelf && requester.role !== 'owner' && requester.role !== 'admin') {
            return reply.code(403).send({ error: 'Only admins can remove members' });
        }

        // 2. Check if removing a pending invitation
        // We assume memberId could be a PendingInvitation ID or a User ID

        // Try to find pending invitation first
        const pending = await prisma.pendingInvitation.findUnique({
            where: { id: memberId }
        });

        if (pending) {
            if (pending.workspaceId !== workspaceId) {
                return reply.code(404).send({ error: 'Invitation not found in this workspace' });
            }
            await prisma.pendingInvitation.delete({ where: { id: memberId } });
            return { ok: true };
        }

        // 3. Try to find active member (memberId is treated as userId here)
        const memberToRemove = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: memberId, workspaceId } },
            include: { user: true }
        });

        if (!memberToRemove) {
            return reply.code(404).send({ error: 'Member not found' });
        }

        // Prevent owners from removing themselves (only other owners can remove an owner)
        if (memberToRemove.role === 'owner' && isSelf) {
            return reply.code(403).send({ error: 'Owners cannot remove themselves. Another owner must remove you.' });
        }

        // Prevent removing the last owner
        if (memberToRemove.role === 'owner') {
            const ownersCount = await prisma.workspaceMember.count({
                where: { workspaceId, role: 'owner' }
            });
            if (ownersCount <= 1) {
                return reply.code(400).send({ error: 'Cannot remove the last owner' });
            }
        }

        await prisma.workspaceMember.delete({
            where: { userId_workspaceId: { userId: memberId, workspaceId } }
        });

        // Send email notification if removed by someone else
        if (!isSelf) {
            // Fire-and-forget
            setTimeout(() => {
                EmailService.sendMemberRemovedEmail(
                    memberToRemove.user.email,
                    requester.workspace.name
                ).catch(err => {
                    console.error('[Req] Failed to send removal email (background):', err);
                });
            }, 0);
        }

        return { ok: true };
    });
}
