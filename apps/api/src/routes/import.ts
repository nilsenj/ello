import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import multipart from '@fastify/multipart';
import { parse as parseCSV } from 'csv-parse/sync';

function mid(a?: string | null, b?: string | null) {
    // minimal rank helper – keeps valid order even without full fractional index impl
    if (!a && !b) return 'n';
    if (!a) return b! + 'a';
    if (!b) return a + 'n';
    return a + 'm'; // simple middle
}

export async function registerImportRoutes(app: FastifyInstance, prisma: PrismaClient) {
    await app.register(multipart);

    // ---------- CSV IMPORT ----------
    app.post('/api/import/csv', async (req) => {
        const mp = await req.file();
        if (!mp) return { ok: false, error: 'No file' };
        const buf = await mp.toBuffer();
        const rows = parseCSV(buf, { columns: true, skip_empty_lines: true }) as any[];

        const cache = new Map<string, string>();
        for (const r of rows) {
            const wKey = `w:${r.workspaceName}`;
            let workspaceId = cache.get(wKey);
            if (!workspaceId) {
                const w = await prisma.workspace.upsert({
                    where: { name: r.workspaceName },
                    update: {},
                    create: { name: r.workspaceName },
                    select: { id: true }
                });
                workspaceId = w.id; cache.set(wKey, workspaceId);
            }

            const bKey = `b:${workspaceId}:${r.boardName}`;
            let boardId = cache.get(bKey);
            if (!boardId) {
                const b = await prisma.board.upsert({
                    where: { workspaceId_name: { workspaceId, name: r.boardName } },
                    update: {},
                    create: { workspaceId, name: r.boardName },
                    select: { id: true }
                });
                boardId = b.id; cache.set(bKey, boardId);
            }

            const lKey = `l:${boardId}:${r.listTitle}`;
            let listId = cache.get(lKey);
            if (!listId) {
                const last = await prisma.list.findFirst({
                    where: { boardId }, orderBy: { rank: 'desc' }, select: { rank: true }
                });
                const rank = mid(last?.rank ?? null, null);
                const l = await prisma.list.create({
                    data: { boardId, name: r.listTitle, rank }, select: { id: true }
                });
                listId = l.id; cache.set(lKey, listId);
            }

            if (r.cardTitle) {
                const lastCard = await prisma.card.findFirst({
                    where: { listId }, orderBy: { rank: 'desc' }, select: { rank: true }
                });
                const rank = mid(lastCard?.rank ?? null, null);
                await prisma.card.create({ data: { listId, title: r.cardTitle, rank } });
            }
        }
        return { ok: true, imported: rows.length };
    });

    // ---------- JSON IMPORT (raw JSON OR multipart file) ----------
    app.post('/api/import/json', async (req) => {
        let body: any;

        // If the request is multipart, read the uploaded file and parse JSON
        if (req.isMultipart()) {
            const mp = await req.file();
            if (!mp) return { ok: false, error: 'No file' };
            const buf = await mp.toBuffer();
            try {
                body = JSON.parse(buf.toString('utf8'));
            } catch (e) {
                return { ok: false, error: 'Invalid JSON file' };
            }
        } else {
            // Raw JSON body
            body = (req as FastifyRequest).body as any;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch { body = undefined; }
            }
        }

        if (!body || typeof body !== 'object') {
            return { ok: false, error: 'No JSON body provided' };
        }

        // expect { workspace: {name}, board: {name}, lists: [{title, cards:[{title}]}] }
        const workspaceName = body.workspace?.name ?? 'Default';
        const boardName = body.board?.name ?? 'Imported';

        const w = await prisma.workspace.upsert({
            where: { name: workspaceName },
            update: {},
            create: { name: workspaceName },
            select: { id: true }
        });

        const b = await prisma.board.upsert({
            where: { workspaceId_name: { workspaceId: w.id, name: boardName } },
            update: {},
            create: { workspaceId: w.id, name: boardName },
            select: { id: true }
        });

        const lists: Array<{ title?: string; name?: string; cards?: Array<{ title?: string }> }> = body.lists ?? [];
        for (let i = 0; i < lists.length; i++) {
            const l = lists[i] ?? {};
            const listTitle = l.title ?? l.name ?? `List ${i + 1}`;

            const last = await prisma.list.findFirst({
                where: { boardId: b.id }, orderBy: { rank: 'desc' }, select: { rank: true }
            });
            const listRank = mid(last?.rank ?? null, null);

            const list = await prisma.list.create({
                data: { boardId: b.id, name: listTitle, rank: listRank }
            });

            const cards = Array.isArray(l.cards) ? l.cards : [];
            for (let j = 0; j < cards.length; j++) {
                const c = cards[j] ?? {};
                const lastCard = await prisma.card.findFirst({
                    where: { listId: list.id }, orderBy: { rank: 'desc' }, select: { rank: true }
                });
                const cardRank = mid(lastCard?.rank ?? null, null);
                await prisma.card.create({
                    data: { listId: list.id, title: c.title ?? `Card ${j + 1}`, rank: cardRank }
                });
            }
        }

        return { ok: true };
    });
}
