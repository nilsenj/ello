// apps/api/src/routes/cards.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CardRole, PrismaClient } from '@prisma/client';

import { between } from '../utils/rank.js';
import { ensureUser } from '../utils/ensure-user.js';
import { ensureBoardAccess } from '../utils/permissions.js';
import { NotificationService } from '../services/notification-service.js';
import { emitToBoard } from '../socket.js';

type ListParams = { listId: string };
type CreateCardBody = { title: string; description?: string };
type CardParams = { id: string };
type MoveBody = { beforeId?: string | null; afterId?: string | null; toListId: string };
type CommentCreateBody = { text: string };
type PatchCardBody = Partial<{
    title: string;
    description: string;
    startDate: string | null;  // ISO
    dueDate: string | null;    // ISO
    priority: 'low' | 'medium' | 'high' | 'urgent' | null;
    risk: 'low' | 'medium' | 'high' | null;
    estimate: number | null;
    isArchived: boolean;
    isDone: boolean;
}>;

// --- helpers ---------------------------------------------------------------
const has = (o: any, k: string) => Object.prototype.hasOwnProperty.call(o ?? {}, k);

const shapeCard = (c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    listId: c.listId,
    rank: c.rank,
    labelIds: (c.labels ?? []).map((x: any) => x.labelId),
    coverAttachment: c.attachments?.[0] ?? null,
    priority: c.priority,
    risk: c.risk,
    estimate: c.estimate,
    startDate: c.startDate,
    dueDate: c.dueDate,
    isArchived: c.isArchived,
    isDone: c.isDone,
});


// Accepts ISO string (or date-only 'YYYY-MM-DD'), returns Date or null
function toDateOrNull(v: unknown): Date | null {
    if (v === null) return null;
    if (typeof v !== 'string') return null;
    // Support date-only values by normalizing to 00:00:00 local (or choose UTC)
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
}

async function boardIdByList(prisma: PrismaClient, listId: string) {
    const row = await prisma.list.findUnique({
        where: { id: listId },
        select: { boardId: true },
    });
    return row?.boardId ?? null;
}

async function boardIdByCard(prisma: PrismaClient, cardId: string) {
    const row = await prisma.card.findUnique({
        where: { id: cardId },
        select: { list: { select: { boardId: true } } },
    });
    return row?.list?.boardId ?? null;
}



// --- routes ----------------------------------------------------------------

export async function registerCardRoutes(app: FastifyInstance, prisma: PrismaClient, notificationService?: NotificationService) {
    // list-scoped: read (RETURN labelIds + cover) — members only
    app.get('/api/lists/:listId/cards', async (req: FastifyRequest<{ Params: ListParams }>) => {
        const user = ensureUser(req);
        const { listId } = req.params;

        const bId = await boardIdByList(prisma, listId);
        await ensureBoardAccess(prisma, bId!, user.id);

        const cards = await prisma.card.findMany({
            where: { listId },
            orderBy: { rank: 'asc' },
            include: {
                labels: { select: { labelId: true } },
                attachments: { where: { isCover: true }, take: 1, select: { id: true, url: true, mime: true, isCover: true } }
            },
        });
        return cards.map(shapeCard);
    });

    // read one card with relations — members only
    app.get('/api/cards/:id', async (req: FastifyRequest<{ Params: CardParams }>) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const bId = await boardIdByCard(prisma, id);
        await ensureBoardAccess(prisma, bId!, user.id);

        return prisma.card.findUnique({
            where: { id },
            include: {
                labels: { select: { labelId: true } },
                assignees: { include: { user: true } },
                checklists: { include: { items: true } },
                attachments: true,
                comments: { include: { author: true }, orderBy: { createdAt: 'desc' } },
            },
        });
    });

    // ---- activity helper -----------------------------------------------------
    const logActivity = async (boardId: string, userId: string, type: string, payload: any, cardId?: string) => {
        await prisma.activity.create({
            data: {
                type,
                payload,
                board: { connect: { id: boardId } },
                user: { connect: { id: userId } },
                card: cardId ? { connect: { id: cardId } } : undefined
            }
        });
    };

    // create card in list — members only
    app.post('/api/lists/:listId/cards', async (req: FastifyRequest<{ Params: ListParams; Body: CreateCardBody }>) => {
        const user = ensureUser(req);
        const { listId } = req.params;
        const { title, description } = req.body;

        const bId = await boardIdByList(prisma, listId);
        await ensureBoardAccess(prisma, bId!, user.id);

        const prev = await prisma.card.findFirst({
            where: { listId },
            orderBy: { rank: 'desc' },
            select: { rank: true },
        });
        const newRank = between(prev?.rank ?? null, null);

        const created = await prisma.card.create({
            data: { listId, title, description, rank: newRank },
            include: { labels: { select: { labelId: true } } },
        });

        // Log activity with list name
        const list = await prisma.list.findUnique({ where: { id: listId }, select: { name: true } });
        if (bId) {
            await logActivity(bId, user.id, 'create_card', { listName: list?.name }, created.id);
            // Real-time update
            emitToBoard(bId, 'card:created', created);
        }

        return shapeCard(created);
    });

    // edit card — members only
    app.patch('/api/cards/:id', async (req: FastifyRequest<{ Params: CardParams; Body: Partial<CreateCardBody> }>) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const bId = await boardIdByCard(prisma, id);
        await ensureBoardAccess(prisma, bId!, user.id);

        const updated = await prisma.card.update({
            where: { id },
            data: req.body,
            include: { labels: { select: { labelId: true } } },
        });

        return shapeCard(updated);
    });

    // move/reorder — members only
    app.post('/api/cards/:id/move', async (req: FastifyRequest<{ Params: CardParams; Body: MoveBody }>) => {
        const user = ensureUser(req);
        const { id } = req.params;
        const { toListId, beforeId, afterId } = req.body;

        const srcBoardId = await boardIdByCard(prisma, id);
        const dstBoardId = await boardIdByList(prisma, toListId);
        await ensureBoardAccess(prisma, srcBoardId!, user.id);
        await ensureBoardAccess(prisma, dstBoardId!, user.id);

        if (srcBoardId !== dstBoardId) {
            const err: any = new Error('Moving across boards is not allowed');
            err.statusCode = 400;
            throw err;
        }

        const before = beforeId
            ? await prisma.card.findUnique({ where: { id: beforeId }, select: { rank: true } })
            : null;

        const after = afterId
            ? await prisma.card.findUnique({ where: { id: afterId }, select: { rank: true } })
            : null;

        const newRank = between(before?.rank ?? null, after?.rank ?? null);

        // Check if list changed
        const currentCard = await prisma.card.findUnique({ where: { id }, select: { listId: true, title: true } });
        const listChanged = currentCard?.listId !== toListId;

        const moved = await prisma.card.update({
            where: { id },
            data: { listId: toListId, rank: newRank },
            include: { labels: { select: { labelId: true } } },
        });

        if (srcBoardId && listChanged) {
            const fromList = await prisma.list.findUnique({ where: { id: currentCard!.listId }, select: { name: true } });
            const toList = await prisma.list.findUnique({ where: { id: toListId }, select: { name: true } });
            await logActivity(srcBoardId, user.id, 'move_card', { fromList: fromList?.name, toList: toList?.name }, id);

            // Trigger notification for move
            if (notificationService && toListId && currentCard && currentCard.listId !== toListId) {
                notificationService.notifyCardMove({
                    cardId: id,
                    actorId: user.id,
                    fromListId: currentCard.listId,
                    toListId: toListId
                }).catch(console.error);
            }

            // Real-time update
            if (currentCard) {
                emitToBoard(srcBoardId, 'card:moved', {
                    cardId: id,
                    toListId: moved.listId,
                    rank: moved.rank,
                    listId: currentCard.listId // source list id
                });
            }
        }

        return shapeCard(moved);
    });

    // delete — members only
    app.delete('/api/cards/:id', async (req: FastifyRequest<{ Params: CardParams }>) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const bId = await boardIdByCard(prisma, id);
        await ensureBoardAccess(prisma, bId!, user.id);

        const card = await prisma.card.findUnique({ where: { id }, select: { title: true } });
        if (bId) await logActivity(bId, user.id, 'delete_card', {}, id);

        return prisma.card.delete({ where: { id } });
    });

    // ---- extended fields -----------------------------------------------------

    app.patch('/api/cards/:id/extended', async (
        req: FastifyRequest<{ Params: CardParams; Body: PatchCardBody }>
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const bId = await boardIdByCard(prisma, id);
        await ensureBoardAccess(prisma, bId!, user.id);

        const body = req.body ?? {};
        const data: Record<string, any> = {};

        // Copy simple fields if present
        if (has(body, 'title')) data.title = body.title;
        if (has(body, 'description')) data.description = body.description;
        if (has(body, 'priority')) data.priority = body.priority;
        if (has(body, 'isArchived')) data.isArchived = body.isArchived;
        if (has(body, 'risk')) data.risk = body.risk;
        if (has(body, 'estimate')) data.estimate = body.estimate;
        if (has(body, 'isDone')) data.isDone = !!body.isDone;

        // Dates: only touch them if keys are present
        if (has(body, 'startDate')) data.startDate = toDateOrNull(body.startDate as any);
        if (has(body, 'dueDate')) data.dueDate = toDateOrNull(body.dueDate as any);

        const updated = await prisma.card.update({ where: { id }, data });

        if (bId && has(body, 'isDone')) {
            await logActivity(bId, user.id, 'card_completion', { cardTitle: updated.title, isDone: data.isDone }, id);
        }
        if (bId && has(body, 'isArchived')) {
            await logActivity(bId, user.id, body.isArchived ? 'archive_card' : 'restore_card', {}, id);
        }

        return updated;
    });

    // ... (labels, assignees, checklists omitted for brevity but could also be logged)

    // ---- comments ------------------------------------------------------------

    app.post('/api/cards/:cardId/comments', async (
        req: FastifyRequest<{ Params: { cardId: string }; Body: CommentCreateBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { cardId } = req.params;
        const { text } = req.body ?? {};
        if (!text?.trim()) return reply.code(400).send({ error: 'text required' });

        const bId = await boardIdByCard(prisma, cardId);
        await ensureBoardAccess(prisma, bId!, user.id);

        const created = await prisma.comment.create({
            data: { text, authorId: user.id, cardId },
            include: { author: { select: { id: true, name: true, avatar: true } } },
        });

        if (bId) await logActivity(bId, user.id, 'comment_card', {}, cardId);

        // Trigger notifications
        if (notificationService) {
            console.log(`[CardsRoute] Triggering comment notification for card ${cardId}`);
            // 1. Notify watchers & assignees
            notificationService.notifyCardComment({
                cardId,
                actorId: user.id,
                commentId: created.id,
                commentText: text
            }).catch(err => console.error('[CardsRoute] Comment notification failed:', err));

            // 2. Check for mentions (e.g. @username)
            const mentionRegex = /@(\w+)/g;
            const matches = [...text.matchAll(mentionRegex)];

            if (matches.length > 0) {
                const usernames = matches.map(m => m[1]);
                const mentionedUsers = await prisma.user.findMany({
                    where: { name: { in: usernames } },
                    select: { id: true }
                });

                mentionedUsers.forEach(u => {
                    notificationService.notifyMention({
                        mentionedUserId: u.id,
                        actorId: user.id,
                        cardId,
                        commentId: created.id,
                        commentText: text
                    }).catch(console.error);
                });
            }
        }

        // Trigger notification for card comment
        if (notificationService) {
            notificationService.notifyCardComment({
                cardId,
                actorId: user.id,
                commentId: created.id,
                commentText: text
            }).catch(err => console.error('Notification error:', err));
        }

        return created;
    });

    // ... rest of file


    // ---- labels (added to match UI) ------------------------------------------

    app.post('/api/cards/:cardId/labels', async (
        req: FastifyRequest<{ Params: { cardId: string }; Body: { labelId: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { cardId } = req.params;
        const { labelId } = req.body ?? {};
        if (!labelId) return reply.code(400).send({ error: 'labelId required' });

        const bId = await boardIdByCard(prisma, cardId);
        await ensureBoardAccess(prisma, bId!, user.id);

        await prisma.cardLabel.upsert({
            where: { cardId_labelId: { cardId, labelId } },
            update: {},
            create: { cardId, labelId },
        });
        return reply.code(204).send();
    });

    app.delete('/api/cards/:cardId/labels/:labelId', async (
        req: FastifyRequest<{ Params: { cardId: string; labelId: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { cardId, labelId } = req.params;

        const bId = await boardIdByCard(prisma, cardId);
        await ensureBoardAccess(prisma, bId!, user.id);

        await prisma.cardLabel.delete({ where: { cardId_labelId: { cardId, labelId } } }).catch(() => {
        });
        return reply.code(204).send();
    });

    // ---- assignees -----------------------------------------------------------

    type AssignBody = { userId: string };

    app.post('/api/cards/:cardId/assignees', async (
        req: FastifyRequest<{ Params: { cardId: string }; Body: AssignBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { cardId } = req.params;
        const { userId } = req.body ?? {};
        if (!userId) return reply.code(400).send({ error: 'userId required' });

        const bId = await boardIdByCard(prisma, cardId);
        await ensureBoardAccess(prisma, bId!, user.id);

        let targetIsMember = await prisma.boardMember.findFirst({ where: { boardId: bId!, userId } });

        if (!targetIsMember) {
            // Check if workspace member
            const board = await prisma.board.findUnique({ where: { id: bId! }, select: { workspaceId: true, visibility: true } });
            const workspaceMember = await prisma.workspaceMember.findUnique({
                where: { userId_workspaceId: { userId, workspaceId: board!.workspaceId } }
            });

            if (workspaceMember) {
                // Auto-add to board
                targetIsMember = await prisma.boardMember.create({
                    data: { boardId: bId!, userId, role: 'member' }
                });
            } else {
                return reply.code(400).send({ error: 'Assignee must be a member of this board or its workspace' });
            }
        }

        await prisma.cardMember.upsert({
            where: { cardId_userId: { cardId, userId } },
            update: {},
            create: { cardId, userId },
        });

        // Trigger notification for assignment
        if (notificationService) {
            console.log(`[CardsRoute] Triggering assignment notification for user ${userId} on card ${cardId}`);
            notificationService.notifyCardAssignment({
                assigneeId: userId,
                actorId: user.id,
                cardId
            }).catch(err => console.error('[CardsRoute] Notification failed:', err));
        } else {
            console.warn('[CardsRoute] NotificationService not available');
        }

        return reply.code(204).send();
    });

    app.delete('/api/cards/:cardId/assignees/:userId', async (
        req: FastifyRequest<{ Params: { cardId: string; userId: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { cardId, userId } = req.params;

        const bId = await boardIdByCard(prisma, cardId);
        await ensureBoardAccess(prisma, bId!, user.id);

        await prisma.cardMember.delete({ where: { cardId_userId: { cardId, userId } } }).catch(() => {
        });
        return reply.code(204).send();
    });

    // ---- checklists ----------------------------------------------------------

    type ChecklistCreateBody = { title: string };
    type ChecklistRenameBody = { title: string };

    app.post('/api/cards/:cardId/checklists', async (
        req: FastifyRequest<{ Params: { cardId: string }; Body: ChecklistCreateBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { cardId } = req.params;
        const { title } = req.body ?? {};
        if (!title?.trim()) return reply.code(400).send({ error: 'title required' });

        const bId = await boardIdByCard(prisma, cardId);
        await ensureBoardAccess(prisma, bId!, user.id);

        const last = await prisma.checklist.findFirst({
            where: { cardId },
            orderBy: { position: 'desc' },
            select: { position: true },
        });
        const position = (last?.position ?? 0) + 1;

        const created = await prisma.checklist.create({ data: { title, position, cardId } });
        return created;
    });

    app.patch('/api/checklists/:id', async (
        req: FastifyRequest<{ Params: { id: string }; Body: ChecklistRenameBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const bId = await prisma.checklist
            .findUnique({ where: { id }, select: { card: { select: { list: { select: { boardId: true } } } } } })
            .then(r => r?.card?.list?.boardId ?? null);
        await ensureBoardAccess(prisma, bId!, user.id);

        const { title } = req.body ?? {};
        if (!title?.trim()) return reply.code(400).send({ error: 'title required' });

        const updated = await prisma.checklist.update({ where: { id }, data: { title } });
        return updated;
    });

    // ---- checklist items -----------------------------------------------------

    type ChecklistItemCreateBody = { text: string };
    type ChecklistItemPatchBody = { text?: string; done?: boolean };

    app.post('/api/checklists/:id/items', async (
        req: FastifyRequest<{ Params: { id: string }; Body: ChecklistItemCreateBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;
        const { text } = req.body ?? {};
        if (!text?.trim()) return reply.code(400).send({ error: 'text required' });

        const bId = await prisma.checklist
            .findUnique({ where: { id }, select: { card: { select: { list: { select: { boardId: true } } } } } })
            .then(r => r?.card?.list?.boardId ?? null);
        await ensureBoardAccess(prisma, bId!, user.id);

        const last = await prisma.checklistItem.findFirst({
            where: { checklistId: id },
            orderBy: { position: 'desc' },
            select: { position: true },
        });
        const position = (last?.position ?? 0) + 1;

        const created = await prisma.checklistItem.create({ data: { text, position, checklistId: id } });
        return created;
    });

    app.patch('/api/checklist-items/:id', async (
        req: FastifyRequest<{ Params: { id: string }; Body: ChecklistItemPatchBody }>
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const bId = await prisma.checklistItem
            .findUnique({
                where: { id },
                select: { checklist: { select: { card: { select: { list: { select: { boardId: true } } } } } } }
            })
            .then(r => r?.checklist?.card?.list?.boardId ?? null);
        await ensureBoardAccess(prisma, bId!, user.id);

        const data: ChecklistItemPatchBody = {};
        if (typeof req.body?.text === 'string') data.text = req.body.text;
        if (typeof req.body?.done === 'boolean') data.done = req.body.done;

        const updated = await prisma.checklistItem.update({ where: { id }, data });
        return updated;
    });

    app.delete('/api/checklist-items/:id', async (
        req: FastifyRequest<{ Params: { id: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const bId = await prisma.checklistItem
            .findUnique({
                where: { id },
                select: { checklist: { select: { card: { select: { list: { select: { boardId: true } } } } } } }
            })
            .then(r => r?.checklist?.card?.list?.boardId ?? null);

        // If item doesn't exist, bId is null. 
        // We could return 404, but 204 is also fine for idempotency if we prefer.
        // However, to be safe and consistent with other routes:
        if (bId) {
            await ensureBoardAccess(prisma, bId!, user.id);
            await prisma.checklistItem.delete({ where: { id } });
        }

        return reply.code(204).send();
    });

    app.delete('/api/checklists/:id', async (
        req: FastifyRequest<{ Params: { id: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const bId = await prisma.checklist
            .findUnique({ where: { id }, select: { card: { select: { list: { select: { boardId: true } } } } } })
            .then(r => r?.card?.list?.boardId ?? null);

        if (bId) {
            await ensureBoardAccess(prisma, bId!, user.id);
            await prisma.checklist.delete({ where: { id } });
        }

        return reply.code(204).send();
    });

    // ---- comments ------------------------------------------------------------



    app.delete('/api/comments/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const c = await prisma.comment.findUnique({
            where: { id },
            select: { authorId: true, card: { select: { list: { select: { boardId: true } } } } },
        });
        if (!c) return reply.code(204).send();

        await ensureBoardAccess(prisma, c.card.list.boardId, user.id);

        // Optional: enforce author-only deletion
        // if (c.authorId !== user.id) return reply.code(403).send({ error: 'Forbidden' });

        await prisma.comment.delete({ where: { id } });
        return reply.code(204).send();
    });

    // PATCH /api/cards/:cardId/assignees/:userId/role
    // Body can be either:
    //   { role: "pm", customRole: null }              // flat (preferred)
    // or
    //   { role: { role: "other", customRole: "SEO" } } // nested (legacy)
    app.patch<{
        Params: { cardId: string; userId: string },
        Body: {
            role?: CardRole | { role?: CardRole | null; customRole?: string | null } | null;
            customRole?: string | null
        }
    }>('/api/cards/:cardId/assignees/:userId/role', async (req, reply) => {
        const user = ensureUser(req);
        const { cardId, userId } = req.params;

        // Ensure caller is a member of the board that owns this card
        const bId = await boardIdByCard(prisma, cardId);
        await ensureBoardAccess(prisma, bId!, user.id);

        // --- Accept both flat and nested body shapes ---
        let role: CardRole | null = null;
        let customRole: string | null = null;

        const rawRole = (req.body?.role ?? null) as unknown;
        const rawCustom = (req.body?.customRole ?? null) as unknown;

        if (typeof rawRole === 'string' || rawRole === null) {
            // flat: { role: "pm", customRole: null }
            role = rawRole as CardRole | null;
            customRole = (typeof rawCustom === 'string' ? rawCustom : null);
        } else if (rawRole && typeof rawRole === 'object') {
            // nested: { role: { role: "other", customRole: "SEO" } }
            role = ((rawRole as any).role ?? null) as CardRole | null;
            customRole = (rawRole as any).customRole ?? null;
        }

        // --- Validate role value (optional but safer) ---
        const allowed: CardRole[] = ['developer', 'designer', 'qa', 'analyst', 'pm', 'devops', 'other'];
        if (role !== null && !allowed.includes(role)) {
            return reply.code(400).send({ error: 'Invalid role value' });
        }

        // Normalize: only keep customRole for 'other'
        if (role && role !== 'other') customRole = null;
        if (typeof customRole === 'string') {
            const trimmed = customRole.trim();
            customRole = trimmed.length ? trimmed : null;
        }

        try {
            const updated = await prisma.cardMember.update({
                where: { cardId_userId: { cardId, userId } },
                data: { role, customRole }, // <-- flat fields here
                select: { userId: true, role: true, customRole: true },
            });
            return reply.send(updated);
        } catch (err: any) {
            // If the assignee record doesn't exist yet
            if (err?.code === 'P2025') {
                return reply.code(404).send({ error: 'Assignee not found on this card' });
            }
            throw err;
        }
    });
}
