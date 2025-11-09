// apps/api/src/routes/cards.ts
import type {FastifyInstance, FastifyRequest} from 'fastify';
import type {PrismaClient} from '@prisma/client';
import {between} from '../utils/rank.js';

type ListParams = { listId: string };
type CreateCardBody = { title: string; description?: string };
type CardParams = { id: string };
type MoveBody = { beforeId?: string | null; afterId?: string | null; toListId: string };
type CommentCreateBody = { text: string };

// helper: shape card → include labelIds
const shapeCard = (c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    listId: c.listId,
    rank: c.rank,
    labelIds: (c.labels ?? []).map((x: any) => x.labelId),
});

export async function registerCardRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // list-scoped: read (RETURN labelIds)
    app.get('/api/lists/:listId/cards', async (req: FastifyRequest<{ Params: ListParams }>) => {
        const {listId} = req.params;
        const cards = await prisma.card.findMany({
            where: {listId},
            orderBy: {rank: 'asc'},
            include: {labels: {select: {labelId: true}}}, // <— include junctions
        });
        return cards.map(shapeCard);
    });

    // ADD: read one card with relations
    app.get('/api/cards/:id', async (req: FastifyRequest<{ Params: CardParams }>) => {
        const {id} = req.params;
        return prisma.card.findUnique({
            where: {id},
            include: {
                labels: { select: { labelId: true } },
                assignees: {include: {user: true}},
                checklists: {include: {items: true}},
                attachments: true,
                comments: { include: { author: true }, orderBy: { createdAt: 'desc' } },
            },
        });
    });

    // list-scoped: create (RETURN labelIds)
    app.post('/api/lists/:listId/cards', async (req: FastifyRequest<{ Params: ListParams; Body: CreateCardBody }>) => {
        const {listId} = req.params;
        const {title, description} = req.body;

        const before = await prisma.card.findFirst({
            where: {listId},
            orderBy: {rank: 'desc'},
            select: {rank: true},
        });
        const newRank = between(before?.rank ?? null, null); // append

        const created = await prisma.card.create({
            data: {listId, title, description, rank: newRank},
            include: {labels: {select: {labelId: true}}},
        });
        return shapeCard(created);
    });

    // edit (RETURN labelIds)
    app.patch('/api/cards/:id', async (req: FastifyRequest<{ Params: CardParams; Body: Partial<CreateCardBody> }>) => {
        const {id} = req.params;
        const data = req.body;
        const updated = await prisma.card.update({
            where: {id},
            data,
            include: {labels: {select: {labelId: true}}},
        });
        return shapeCard(updated);
    });

    // move/reorder (RETURN labelIds)
    app.post('/api/cards/:id/move', async (req: FastifyRequest<{ Params: CardParams; Body: MoveBody }>) => {
        const {id} = req.params;
        const {toListId, beforeId, afterId} = req.body;

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

    app.delete('/api/cards/:id', (req: FastifyRequest<{ Params: CardParams }>) => {
        const {id} = req.params;
        return prisma.card.delete({where: {id}});
    });

    // ADD: patch extended fields
    type PatchCardBody = Partial<{
        title: string;
        description: string;
        startDate: string | null;
        dueDate: string | null;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        isArchived: boolean;
    }>;

    app.patch('/api/cards/:id/extended', (req: FastifyRequest<{ Params: CardParams; Body: PatchCardBody }>) => {
        const {id} = req.params;
        const {startDate, dueDate, ...rest} = req.body;
        return prisma.card.update({
            where: {id},
            data: {
                ...rest,
                startDate: startDate ? new Date(startDate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
            },
        });
    });

    // ---------------- Assignees ----------------
    type AssignBody = { userId: string };

    app.post('/api/cards/:cardId/assignees', async (req: FastifyRequest<{
        Params: { cardId: string },
        Body: AssignBody
    }>, reply) => {
        const {cardId} = req.params;
        const {userId} = req.body;
        if (!userId) return reply.code(400).send({error: 'userId required'});

        // Optional safety: ensure user is member of the card's board
        const card = await prisma.card.findUnique({
            where: {id: cardId},
            select: {list: {select: {boardId: true}}}
        });
        if (!card) return reply.code(404).send({error: 'Card not found'});
        const member = await prisma.boardMember.findFirst({
            where: {boardId: card.list.boardId, userId}
        });
        if (!member) return reply.code(400).send({error: 'User is not a member of this board'});

        await prisma.cardMember.upsert({
            where: {cardId_userId: {cardId, userId}},
            update: {},
            create: {cardId, userId},
        });
        return reply.code(204).send();
    });

    app.delete('/api/cards/:cardId/assignees/:userId', async (req: FastifyRequest<{
        Params: { cardId: string, userId: string }
    }>, reply) => {
        const {cardId, userId} = req.params;
        await prisma.cardMember.delete({
            where: {cardId_userId: {cardId, userId}},
        }).catch(() => {
        });
        return reply.code(204).send();
    });

// ---------------- Checklists ----------------
    type ChecklistCreateBody = { title: string };
    type ChecklistRenameBody = { title: string };

    app.post('/api/cards/:cardId/checklists', async (req: FastifyRequest<{
        Params: { cardId: string },
        Body: ChecklistCreateBody
    }>, reply) => {
        const {cardId} = req.params;
        const {title} = req.body ?? {};
        if (!title?.trim()) return reply.code(400).send({error: 'title required'});

        const last = await prisma.checklist.findFirst({
            where: {cardId},
            orderBy: {position: 'desc'},
            select: {position: true}
        });
        const position = (last?.position ?? 0) + 1;

        const created = await prisma.checklist.create({data: {title, position, cardId}});
        return created;
    });

    app.patch('/api/checklists/:id', async (req: FastifyRequest<{
        Params: { id: string },
        Body: ChecklistRenameBody
    }>, reply) => {
        const {id} = req.params;
        const {title} = req.body ?? {};
        if (!title?.trim()) return reply.code(400).send({error: 'title required'});

        const updated = await prisma.checklist.update({where: {id}, data: {title}});
        return updated;
    });

// ---------------- Checklist Items ----------------
    type ChecklistItemCreateBody = { text: string };
    type ChecklistItemPatchBody = { text?: string; done?: boolean };

    app.post('/api/checklists/:id/items', async (req: FastifyRequest<{
        Params: { id: string },
        Body: ChecklistItemCreateBody
    }>, reply) => {
        const {id} = req.params;
        const {text} = req.body ?? {};
        if (!text?.trim()) return reply.code(400).send({error: 'text required'});

        const last = await prisma.checklistItem.findFirst({
            where: {checklistId: id},
            orderBy: {position: 'desc'},
            select: {position: true}
        });
        const position = (last?.position ?? 0) + 1;

        const created = await prisma.checklistItem.create({data: {text, position, checklistId: id}});
        return created;
    });

    app.patch('/api/checklist-items/:id', async (req: FastifyRequest<{
        Params: { id: string },
        Body: ChecklistItemPatchBody
    }>) => {
        const {id} = req.params;
        const data: ChecklistItemPatchBody = {};
        if (typeof req.body?.text === 'string') data.text = req.body.text;
        if (typeof req.body?.done === 'boolean') data.done = req.body.done;

        const updated = await prisma.checklistItem.update({where: {id}, data});
        return updated;
    });

// ---------------- Comments ----------------
// NOTE: Replace this with your real auth integration
    function getUserId(req: FastifyRequest) {
        // real auth → set req.user.id or forward header from frontend
        return (req as any).user?.id || (req.headers['x-user-id'] as string) || 'demo-user';
    }

    // ensure there is a row in User table for this id
    async function ensureAuthor(prisma: PrismaClient, id: string) {
        // we also need an email because it's unique+required
        const email = `${id}@local.invalid`;
        await prisma.user.upsert({
            where: {id},
            update: {},
            create: {
                id,                // you can set id explicitly even if @default(cuid())
                email,
                name: id === 'demo-user' ? 'Demo User' : id,
                password: 'x',     // placeholder; irrelevant if you don’t use password login
            },
        });
    }

    app.post('/api/cards/:cardId/comments', async (req: FastifyRequest<{
        Params: { cardId: string },
        Body: { text: string }
    }>, reply) => {
        const {cardId} = req.params;
        const {text} = req.body ?? {};
        if (!text?.trim()) return reply.code(400).send({error: 'text required'});

        const authorId = getUserId(req);
        await ensureAuthor(prisma, authorId);  // <-- make sure FK target exists

        const created = await prisma.comment.create({
            data: {text, authorId, cardId},
            include: {author: {select: {id: true, name: true, avatar: true}}},
        });
        return created;
    });

    app.delete('/api/comments/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const {id} = req.params;

        // Optional enforcement: only author can delete
        const authorId = getUserId(req);
        const c = await prisma.comment.findUnique({where: {id}, select: {authorId: true}});
        if (!c) return reply.code(204).send();
        if (c.authorId !== authorId) return reply.code(403).send({error: 'Forbidden'});

        await prisma.comment.delete({where: {id}});
        return reply.code(204).send();
    });
}
