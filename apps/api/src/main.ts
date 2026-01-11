// apps/api/src/main.ts
import Fastify, { FastifyPluginAsync } from 'fastify';
import fastifyCors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyStatic, { FastifyStaticOptions } from '@fastify/static';
import fastifyJwt from '@fastify/jwt';            // ✅ v8 for Fastify v4
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

import { registerListRoutes } from './routes/lists.js';
import { registerBoardRoutes } from './routes/boards.js';
import { registerCardRoutes } from './routes/cards.js';
import { registerImportRoutes } from './routes/import.js';
import { registerLabelRoutes } from './routes/labels.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerWorkspaceRoutes } from './routes/workspaces.js';
import { registerAttachmentRoutes } from './routes/attachments.js';
import { registerActivityRoutes } from './routes/activity.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerServiceDeskRoutes } from './routes/service-desk.js';
import { registerFulfillmentRoutes } from './routes/fulfillment.js';
import { registerPushRoutes } from './routes/push.js';
import { registerBillingRoutes } from './routes/billing.js';
import { registerAdminRoutes } from './routes/admin.js';
import { setupSocketIO } from './socket.js';
import { NotificationService } from './services/notification-service.js';
import { startServiceDeskSlaScanner } from './services/service-desk-sla-scanner.js';
import { startFulfillmentSlaScanner } from './services/fulfillment-sla-scanner.js';

const prisma = new PrismaClient();

async function bootstrap() {
    const app = Fastify({ logger: true });
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
    const PORT = Number(process.env.PORT || 3000);
    const HOST = process.env.HOST || '0.0.0.0';
    const UPLOAD_DIR =
        process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
    const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    await app.register(fastifyCors, { origin: true, credentials: true, exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'] });
    await app.register(cookie, { secret: process.env.COOKIE_SECRET || 'dev-cookie' });

    // Register JWT
    await app.register(fastifyJwt, { secret: JWT_SECRET });
    app.decorate('prisma', prisma);

    // Attach user + enforce bans for any authenticated request
    app.addHook('preHandler', async (req, reply) => {
        const auth = req.headers.authorization || '';
        if (!auth.startsWith('Bearer ')) return;
        const token = auth.slice(7);
        if (!token) return;
        try {
            const payload = jwt.verify(token, JWT_SECRET) as { sub?: string; email?: string };
            const userId = payload.sub;
            if (!userId) return;
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, isBanned: true, isSuperAdmin: true },
            });
            if (!user) return reply.code(401).send({ error: 'Unauthorized' });
            if (user.isBanned) return reply.code(403).send({ error: 'Account is disabled' });
            (req as any).user = { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
        } catch {
            // Ignore invalid tokens here; route handlers will enforce auth as needed.
        }
    });

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

    // Initialize notification service  
    const notificationService = new NotificationService(prisma);

    await registerCardRoutes(app, prisma, notificationService);
    await registerImportRoutes(app, prisma);
    await registerLabelRoutes(app, prisma);

    // ✅ attachments routes (this will register multipart once, guarded)
    await registerAttachmentRoutes(app, prisma, {
        uploadDir: UPLOAD_DIR,
        publicBaseUrl: PUBLIC_BASE_URL,
        publicPrefix: '/uploads',
    });
    await registerActivityRoutes(app, prisma);
    await registerNotificationRoutes(app, prisma);
    await registerServiceDeskRoutes(app, prisma);
    await registerFulfillmentRoutes(app, prisma);
    await registerBillingRoutes(app, prisma);
    await registerAdminRoutes(app, prisma);
    await registerPushRoutes(app, prisma);

    // Initialize Socket.IO
    await setupSocketIO(app, prisma);

    // Service Desk SLA scanner (overdue alerts)
    startServiceDeskSlaScanner(prisma);
    startFulfillmentSlaScanner(prisma);

    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API on ${PUBLIC_BASE_URL}`);
    app.log.info(`Serving uploads from ${UPLOAD_DIR} at /uploads/*`);
}

bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
