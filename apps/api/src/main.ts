// apps/api/src/main.ts
import Fastify, { FastifyPluginAsync } from 'fastify';
import fastifyCors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyStatic, { FastifyStaticOptions } from '@fastify/static';
import fastifyJwt from '@fastify/jwt';            // ✅ v8 for Fastify v4
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs';

import { registerListRoutes } from './routes/lists.js';
import { registerBoardRoutes } from './routes/boards.js';
import { registerCardRoutes } from './routes/cards.js';
import { registerImportRoutes } from './routes/import.js';
import { registerLabelRoutes } from './routes/labels.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerWorkspaceRoutes } from './routes/workspaces.js';
import { registerAttachmentRoutes } from './routes/attachments.js';
import { registerActivityRoutes } from './routes/activity.js';

const prisma = new PrismaClient();

async function bootstrap() {
    const app = Fastify({ logger: true });
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
    const PORT = Number(process.env.PORT || 3000);
    const HOST = process.env.HOST || '0.0.0.0';
    const UPLOAD_DIR =
        process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
    const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    await app.register(fastifyCors, { origin: true, credentials: true, exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'] });
    await app.register(cookie, { secret: process.env.COOKIE_SECRET || 'dev-cookie' });

    // ❌ remove multipart here (plugin will handle it)
    // await app.register(fastifyMultipart, ...)

    // Serve uploaded files as /uploads/*
    await app.register(
        fastifyStatic as unknown as FastifyPluginAsync<FastifyStaticOptions>,
        {
            root: path.resolve(UPLOAD_DIR),
            prefix: '/uploads/', // must match opts.publicPrefix
            decorateReply: false
        }
    );

    await registerAuthRoutes(app, prisma);
    await registerWorkspaceRoutes(app, prisma);
    await registerBoardRoutes(app, prisma);
    await registerListRoutes(app, prisma);
    await registerCardRoutes(app, prisma);
    await registerImportRoutes(app, prisma);
    await registerLabelRoutes(app, prisma);

    // ✅ attachments routes (this will register multipart once, guarded)
    await registerAttachmentRoutes(app, prisma, {
        uploadDir: UPLOAD_DIR,
        publicBaseUrl: PUBLIC_BASE_URL,
        publicPrefix: '/uploads',
    });
    await registerActivityRoutes(app, prisma);

    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API on ${PUBLIC_BASE_URL}`);
    app.log.info(`Serving uploads from ${UPLOAD_DIR} at /uploads/*`);
}

bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
