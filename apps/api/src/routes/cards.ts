// apps/api/src/routes/cards.ts
import type {FastifyInstance, FastifyRequest} from 'fastify';
import type {PrismaClient} from '@prisma/client';
import {between} from '../utils/rank.js';
import {ensureUser} from '../utils/ensure-user.js';

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
        where: {id: listId},
        select: {boardId: true},
    });
    return row?.boardId ?? null;
}

async function boardIdByCard(prisma: PrismaClient, cardId: string) {
    const row = await prisma.card.findUnique({
        where: {id: cardId},
        select: {list: {select: {boardId: true}}},
    });
    return row?.list?.boardId ?? null;
}

async function assertBoardMember(prisma: PrismaClient, boardId: string | null, userId: string) {
    if (!boardId) {
        const err: any = new Error('Not Found');
        err.statusCode = 404;
        throw err;
    }
    const member = await prisma.boardMember.findFirst({
        where: {boardId, userId},
        select: {id: true},
    });
    if (!member) {
        const err: any = new Error('Forbidden');
        err.statusCode = 403;
        throw err;
    }
}

// --- routes ----------------------------------------------------------------

export async function registerCardRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // list-scoped: read (RETURN labelIds) — members only
    app.get('/api/lists/:listId/cards', async (req: FastifyRequest<{ Params: ListParams }>) => {
        const user = ensureUser(req);
        const {listId} = req.params;

        const bId = await boardIdByList(prisma, listId);
        await assertBoardMember(prisma, bId, user.id);

        const cards = await prisma.card.findMany({
            where: {listId},
            orderBy: {rank: 'asc'},
            include: {labels: {select: {labelId: true}}},
        });
        return cards.map(shapeCard);
    });

    // read one card with relations — members only
    app.get('/api/cards/:id', async (req: FastifyRequest<{ Params: CardParams }>) => {
        const user = ensureUser(req);
        const {id} = req.params;

        const bId = await boardIdByCard(prisma, id);
        await assertBoardMember(prisma, bId, user.id);

        return prisma.card.findUnique({
            where: {id},
            include: {
                labels: {select: {labelId: true}},
                assignees: {include: {user: true}},
                checklists: {include: {items: true}},
                attachments: true,
                comments: {include: {author: true}, orderBy: {createdAt: 'desc'}},
            },
        });
    });

    // create card in list — members only
    app.post('/api/lists/:listId/cards', async (req: FastifyRequest<{ Params: ListParams; Body: CreateCardBody }>) => {
        const user = ensureUser(req);
        const {listId} = req.params;
        const {title, description} = req.body;

        const bId = await boardIdByList(prisma, listId);
        await assertBoardMember(prisma, bId, user.id);

        const prev = await prisma.card.findFirst({
            where: {listId},
            orderBy: {rank: 'desc'},
            select: {rank: true},
        });
        const newRank = between(prev?.rank ?? null, null);

        const created = await prisma.card.create({
            data: {listId, title, description, rank: newRank},
            include: {labels: {select: {labelId: true}}},
        });
        return shapeCard(created);
    });

    // edit card — members only
    app.patch('/api/cards/:id', async (req: FastifyRequest<{ Params: CardParams; Body: Partial<CreateCardBody> }>) => {
        const user = ensureUser(req);
        const {id} = req.params;

        const bId = await boardIdByCard(prisma, id);
        await assertBoardMember(prisma, bId, user.id);

        const updated = await prisma.card.update({
            where: {id},
            data: req.body,
            include: {labels: {select: {labelId: true}}},
        });
        return shapeCard(updated);
    });

    // move/reorder — members only
    app.post('/api/cards/:id/move', async (req: FastifyRequest<{ Params: CardParams; Body: MoveBody }>) => {
        const user = ensureUser(req);
        const {id} = req.params;
        const {toListId, beforeId, afterId} = req.body;

        const srcBoardId = await boardIdByCard(prisma, id);
        const dstBoardId = await boardIdByList(prisma, toListId);
        await assertBoardMember(prisma, srcBoardId, user.id);
        await assertBoardMember(prisma, dstBoardId, user.id);

        if (srcBoardId !== dstBoardId) {
            const err: any = new Error('Moving across boards is not allowed');
            err.statusCode = 400;
            throw err;
        }

        const before = beforeId
            ? await prisma.card.findUnique({where: {id: beforeId}, select: {rank: true}})
            : null;

        const after = afterId
            ? await prisma.card.findUnique({where: {id: afterId}, select: {rank: true}})
            : null;

        const newRank = between(before?.rank ?? null, after?.rank ?? null);

        const moved = await prisma.card.update({
            where: {id},
            data: {listId: toListId, rank: newRank},
            include: {labels: {select: {labelId: true}}},
        });
        return shapeCard(moved);
    });

    // delete — members only
    app.delete('/api/cards/:id', async (req: FastifyRequest<{ Params: CardParams }>) => {
        const user = ensureUser(req);
        const {id} = req.params;

        const bId = await boardIdByCard(prisma, id);
        await assertBoardMember(prisma, bId, user.id);

        return prisma.card.delete({where: {id}});
    });

    // ---- extended fields -----------------------------------------------------

    app.patch('/api/cards/:id/extended', async (
        req: FastifyRequest<{ Params: CardParams; Body: PatchCardBody }>
    ) => {
        const user = ensureUser(req);
        const {id} = req.params;

        const bId = await boardIdByCard(prisma, id);
        await assertBoardMember(prisma, bId, user.id);

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

        return prisma.card.update({where: {id}, data});
    });

    // ---- labels (added to match UI) ------------------------------------------

    app.post('/api/cards/:cardId/labels', async (
        req: FastifyRequest<{ Params: { cardId: string }; Body: { labelId: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const {cardId} = req.params;
        const {labelId} = req.body ?? {};
        if (!labelId) return reply.code(400).send({error: 'labelId required'});

        const bId = await boardIdByCard(prisma, cardId);
        await assertBoardMember(prisma, bId, user.id);

        await prisma.cardLabel.upsert({
            where: {cardId_labelId: {cardId, labelId}},
            update: {},
            create: {cardId, labelId},
        });
        return reply.code(204).send();
    });

    app.delete('/api/cards/:cardId/labels/:labelId', async (
        req: FastifyRequest<{ Params: { cardId: string; labelId: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const {cardId, labelId} = req.params;

        const bId = await boardIdByCard(prisma, cardId);
        await assertBoardMember(prisma, bId, user.id);

        await prisma.cardLabel.delete({where: {cardId_labelId: {cardId, labelId}}}).catch(() => {
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
        const {cardId} = req.params;
        const {userId} = req.body ?? {};
        if (!userId) return reply.code(400).send({error: 'userId required'});

        const bId = await boardIdByCard(prisma, cardId);
        await assertBoardMember(prisma, bId, user.id);

        const targetIsMember = await prisma.boardMember.findFirst({where: {boardId: bId!, userId}});
        if (!targetIsMember) return reply.code(400).send({error: 'Assignee must be a member of this board'});

        await prisma.cardMember.upsert({
            where: {cardId_userId: {cardId, userId}},
            update: {},
            create: {cardId, userId},
        });
        return reply.code(204).send();
    });

    app.delete('/api/cards/:cardId/assignees/:userId', async (
        req: FastifyRequest<{ Params: { cardId: string; userId: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        const {cardId, userId} = req.params;

        const bId = await boardIdByCard(prisma, cardId);
        await assertBoardMember(prisma, bId, user.id);

        await prisma.cardMember.delete({where: {cardId_userId: {cardId, userId}}}).catch(() => {
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
        const {cardId} = req.params;
        const {title} = req.body ?? {};
        if (!title?.trim()) return reply.code(400).send({error: 'title required'});

        const bId = await boardIdByCard(prisma, cardId);
        await assertBoardMember(prisma, bId, user.id);

        const last = await prisma.checklist.findFirst({
            where: {cardId},
            orderBy: {position: 'desc'},
            select: {position: true},
        });
        const position = (last?.position ?? 0) + 1;

        const created = await prisma.checklist.create({data: {title, position, cardId}});
        return created;
    });

    app.patch('/api/checklists/:id', async (
        req: FastifyRequest<{ Params: { id: string }; Body: ChecklistRenameBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        const {id} = req.params;

        const bId = await prisma.checklist
            .findUnique({where: {id}, select: {card: {select: {list: {select: {boardId: true}}}}}})
            .then(r => r?.card?.list?.boardId ?? null);
        await assertBoardMember(prisma, bId, user.id);

        const {title} = req.body ?? {};
        if (!title?.trim()) return reply.code(400).send({error: 'title required'});

        const updated = await prisma.checklist.update({where: {id}, data: {title}});
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
        const {id} = req.params;
        const {text} = req.body ?? {};
        if (!text?.trim()) return reply.code(400).send({error: 'text required'});

        const bId = await prisma.checklist
            .findUnique({where: {id}, select: {card: {select: {list: {select: {boardId: true}}}}}})
            .then(r => r?.card?.list?.boardId ?? null);
        await assertBoardMember(prisma, bId, user.id);

        const last = await prisma.checklistItem.findFirst({
            where: {checklistId: id},
            orderBy: {position: 'desc'},
            select: {position: true},
        });
        const position = (last?.position ?? 0) + 1;

        const created = await prisma.checklistItem.create({data: {text, position, checklistId: id}});
        return created;
    });

    app.patch('/api/checklist-items/:id', async (
        req: FastifyRequest<{ Params: { id: string }; Body: ChecklistItemPatchBody }>
    ) => {
        const user = ensureUser(req);
        const {id} = req.params;

        const bId = await prisma.checklistItem
            .findUnique({
                where: {id},
                select: {checklist: {select: {card: {select: {list: {select: {boardId: true}}}}}}}
            })
            .then(r => r?.checklist?.card?.list?.boardId ?? null);
        await assertBoardMember(prisma, bId, user.id);

        const data: ChecklistItemPatchBody = {};
        if (typeof req.body?.text === 'string') data.text = req.body.text;
        if (typeof req.body?.done === 'boolean') data.done = req.body.done;

        const updated = await prisma.checklistItem.update({where: {id}, data});
        return updated;
    });

    // ---- comments ------------------------------------------------------------

    app.post('/api/cards/:cardId/comments', async (
        req: FastifyRequest<{ Params: { cardId: string }; Body: CommentCreateBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        const {cardId} = req.params;
        const {text} = req.body ?? {};
        if (!text?.trim()) return reply.code(400).send({error: 'text required'});

        const bId = await boardIdByCard(prisma, cardId);
        await assertBoardMember(prisma, bId, user.id);

        const created = await prisma.comment.create({
            data: {text, authorId: user.id, cardId},
            include: {author: {select: {id: true, name: true, avatar: true}}},
        });
        return created;
    });

    app.delete('/api/comments/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const user = ensureUser(req);
        const {id} = req.params;

        const c = await prisma.comment.findUnique({
            where: {id},
            select: {authorId: true, card: {select: {list: {select: {boardId: true}}}}},
        });
        if (!c) return reply.code(204).send();

        await assertBoardMember(prisma, c.card.list.boardId, user.id);

        // Optional: enforce author-only deletion
        // if (c.authorId !== user.id) return reply.code(403).send({ error: 'Forbidden' });

        await prisma.comment.delete({where: {id}});
        return reply.code(204).send();
    });
}
