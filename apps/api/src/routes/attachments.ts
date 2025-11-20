// apps/api/src/routes/attachments.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ensureUser } from "../utils/ensure-user.js";
// If ensureUser lives in ../utils/ensure-user.js, import from there instead:
// import { ensureUser } from '../utils/ensure-user.js';
import { randomUUID } from 'node:crypto';

type Opts = {
    uploadDir: string;            // absolute dir on disk
    publicBaseUrl: string;        // e.g. http://localhost:3000
    publicPrefix: string;         // e.g. /uploads
};

// ---- little helpers --------------------------------------------------------

async function boardIdByCard(prisma: PrismaClient, cardId: string) {
    const row = await prisma.card.findUnique({
        where: { id: cardId },
        select: { list: { select: { boardId: true } } },
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
        where: { boardId, userId },
        select: { id: true },
    });
    if (!member) {
        const err: any = new Error('Forbidden');
        err.statusCode = 403;
        throw err;
    }
}

function randomName(original?: string) {
    const ext = original ? path.extname(original) : '';
    const base = crypto.randomBytes(16).toString('hex');
    return `${Date.now()}_${base}${ext}`;
}

function isLocalUrl(url: string, publicPrefix: string) {
    // local files we created look like /uploads/<file>
    return typeof url === 'string' && url.startsWith(publicPrefix + '/');
}

async function unlinkIfExists(p: string) {
    try {
        await fs.promises.unlink(p);
    } catch {
        /* ignore */
    }
}

// ---- routes ----------------------------------------------------------------

export async function registerAttachmentRoutes(
    app: FastifyInstance,
    prisma: PrismaClient,
    opts: Opts
) {
    const { uploadDir, publicBaseUrl, publicPrefix } = opts;

    // Ensure dir
    fs.mkdirSync(uploadDir, { recursive: true });

    // 1) Upload attachment (multipart) OR attach by URL (JSON)
    //    - Multipart: field "file" (single). Optional field "name".
    //    - JSON: { url: string, name?: string, mime?: string, size?: number }
    app.post(
        '/api/cards/:cardId/attachments',
        async (req: FastifyRequest<{ Params: { cardId: string } }>, reply) => {
            const user = ensureUser(req);
            const { cardId } = req.params;

            const bId = await boardIdByCard(prisma, cardId);
            await assertBoardMember(prisma, bId, user.id);

            const isMultipart = req.isMultipart();

            // --- Multipart flow ----------------------------------------------------
            if (isMultipart) {
                const parts = req.parts();
                let created: any | null = null;

                for await (const part of parts) {
                    if (part.type !== 'file') continue;
                    // Only one file per request by convention; ignore extra silently
                    const diskName = randomName(part.filename || undefined);
                    const diskPath = path.join(uploadDir, diskName);

                    // Stream file to disk
                    const write = fs.createWriteStream(diskPath);
                    await part.file.pipe(write);
                    await new Promise<void>((res, rej) => {
                        write.on('finish', () => res());
                        write.on('error', rej);
                    });

                    const stat = await fs.promises.stat(diskPath).catch(() => null);
                    const size = stat?.size ? Number(stat.size) : null;

                    const name = ((part.fields as {
                        name?: { value: string }
                    })?.name?.value) || part.filename || 'file';
                    const mime = part.mimetype || undefined;

                    // Store relative public URL (e.g., /uploads/<file>)
                    const url = `${publicPrefix}/${diskName}`;

                    created = await prisma.attachment.create({
                        data: {
                            cardId,
                            name,
                            url,
                            mime,
                            size: size ?? undefined,
                            createdBy: user.id,
                        },
                    });

                    break; // handle single file
                }

                if (!created) {
                    return reply.code(400).send({ error: 'file is required' });
                }

                return created;
            }

            // --- JSON (link) flow --------------------------------------------------
            const body = (req.body ?? {}) as {
                url?: string;
                name?: string;
                mime?: string;
                size?: number;
            };

            const url = (body.url || '').trim();
            if (!url) return reply.code(400).send({ error: 'url required' });

            const created = await prisma.attachment.create({
                data: {
                    cardId,
                    url, // keep as-is (can be absolute external)
                    name: body.name || url,
                    mime: body.mime,
                    size: typeof body.size === 'number' ? body.size : undefined,
                    createdBy: user.id,
                },
            });

            return created;
        }
    );

    // 2) List attachments for a card (optional, as /api/cards/:id already includes them)
    app.get('/api/cards/:cardId/attachments', async (req: FastifyRequest<{ Params: { cardId: string } }>) => {
        const user = ensureUser(req);
        const { cardId } = req.params;

        const bId = await boardIdByCard(prisma, cardId);
        await assertBoardMember(prisma, bId, user.id);

        return prisma.attachment.findMany({
            where: { cardId },
            orderBy: [{ isCover: 'desc' }, { createdAt: 'desc' }],
        });
    });

    // 3) Delete attachment
    app.delete('/api/attachments/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const row = await prisma.attachment.findUnique({
            where: { id },
            select: {
                id: true,
                url: true,
                isCover: true,
                card: { select: { id: true, list: { select: { boardId: true } } } },
            },
        });

        if (!row) return reply.code(204).send();
        await assertBoardMember(prisma, row.card.list.boardId, user.id);

        // If it’s our local file, delete from disk
        if (isLocalUrl(row.url, publicPrefix)) {
            const filename = row.url.substring((publicPrefix + '/').length);
            const diskPath = path.join(uploadDir, filename);
            await unlinkIfExists(diskPath);
        }

        await prisma.attachment.delete({ where: { id } });
        return reply.code(204).send();
    });

    // 4) Set as cover
    app.post('/api/attachments/:id/cover', async (req: FastifyRequest<{ Params: { id: string } }>) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const row = await prisma.attachment.findUnique({
            where: { id },
            select: { id: true, cardId: true, card: { select: { list: { select: { boardId: true } } } } },
        });
        if (!row) {
            const err: any = new Error('Not Found');
            err.statusCode = 404;
            throw err;
        }
        await assertBoardMember(prisma, row.card.list.boardId, user.id);

        await prisma.$transaction([
            prisma.attachment.updateMany({ where: { cardId: row.cardId, isCover: true }, data: { isCover: false } }),
            prisma.attachment.update({ where: { id }, data: { isCover: true } }),
        ]);

        return { ok: true };
    });

    app.delete('/api/attachments/:id/cover', async (req: FastifyRequest<{ Params: { id: string } }>) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const row = await prisma.attachment.findUnique({
            where: { id },
            select: { id: true, card: { select: { list: { select: { boardId: true } } } } },
        });
        if (!row) {
            const err: any = new Error('Not Found');
            err.statusCode = 404;
            throw err;
        }
        await assertBoardMember(prisma, row.card.list.boardId, user.id);

        await prisma.attachment.update({ where: { id }, data: { isCover: false } });

        return { ok: true };
    });

    // 5) Rename attachment (optional quality-of-life)
    app.patch(
        '/api/attachments/:id',
        async (req: FastifyRequest<{ Params: { id: string }; Body: { name?: string } }>, reply) => {
            const user = ensureUser(req);
            const { id } = req.params;
            const { name } = (req.body ?? {}) as { name?: string };

            const row = await prisma.attachment.findUnique({
                where: { id },
                select: { id: true, card: { select: { list: { select: { boardId: true } } } } },
            });
            if (!row) return reply.code(404).send({ error: 'Not Found' });
            await assertBoardMember(prisma, row.card.list.boardId, user.id);

            if (!name?.trim()) return reply.code(400).send({ error: 'name required' });

            const updated = await prisma.attachment.update({ where: { id }, data: { name: name.trim() } });
            return updated;
        }
    );

    // 6) Build absolute URL utility (if you later need to emit absolute URLs)
    app.get('/api/attachments/:id/url', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const user = ensureUser(req);
        const { id } = req.params;
        const row = await prisma.attachment.findUnique({
            where: { id },
            select: { url: true, card: { select: { list: { select: { boardId: true } } } } },
        });
        if (!row) return reply.code(404).send({ error: 'Not Found' });
        await assertBoardMember(prisma, row.card.list.boardId, user.id);

        // If local, convert /uploads/* to absolute, else return as-is
        const absolute = isLocalUrl(row.url, publicPrefix)
            ? `${publicBaseUrl}${row.url}`
            : row.url;
        return { url: absolute };
    });

    // Stream the attachment file via API (auth-checked)
    // - Local files (/uploads/...) are streamed from disk
    // External absolute URLs are redirected
    app.get('/api/attachments/:id/file', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const row = await prisma.attachment.findUnique({
            where: { id },
            select: {
                id: true,
                url: true,
                name: true,
                mime: true,
                card: { select: { list: { select: { boardId: true } } } },
            },
        });

        if (!row) return reply.code(404).send({ error: 'Not Found' });

        await assertBoardMember(prisma, row.card.list.boardId, user.id);

        // If it's an external URL, just redirect
        if (!isLocalUrl(row.url, publicPrefix)) {
            return reply.redirect(302, row.url);
        }

        // Map /uploads/<filename> -> <uploadDir>/<filename>
        const filename = row.url.substring((publicPrefix + '/').length);
        const diskPath = path.join(uploadDir, filename);

        // Stat file
        let stat: fs.Stats;
        try {
            stat = await fs.promises.stat(diskPath);
        } catch {
            return reply.code(404).send({ error: 'File missing' });
        }

        // Optional: force download with ?download=1
        // @ts-ignore
        const download = (req.query && (req.query as any).download) ? true : false;

        // Set headers
        const mime = row.mime || 'application/octet-stream';
        reply.header('Accept-Ranges', 'bytes');
        reply.header('Content-Type', mime);
        if (download) {
            const safeName = (row.name || filename).replace(/[\r\n"]/g, '');
            reply.header('Content-Disposition', `attachment; filename="${safeName}"`);
        }

        // Handle Range (for media scrubbing)
        const range = (req.headers.range || '') as string;
        if (range && /^bytes=\d*-\d*$/.test(range)) {
            const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
            const start = startStr ? parseInt(startStr, 10) : 0;
            const end = endStr ? parseInt(endStr, 10) : stat.size - 1;

            if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stat.size) {
                reply.header('Content-Range', `bytes */${stat.size}`);
                return reply.code(416).send(); // Range Not Satisfiable
            }

            reply
                .code(206)
                .header('Content-Range', `bytes ${start}-${end}/${stat.size}`)
                .header('Content-Length', String(end - start + 1));

            const stream = fs.createReadStream(diskPath, { start, end });
            return reply.send(stream);
        }

        // No Range → full file
        reply.header('Content-Length', String(stat.size));
        const stream = fs.createReadStream(diskPath);
        return reply.send(stream);
    });

}
