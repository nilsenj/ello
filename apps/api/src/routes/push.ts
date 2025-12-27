import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { ensureUser } from '../utils/ensure-user.js';

type RegisterBody = { token: string; platform: string };

export async function registerPushRoutes(app: FastifyInstance, prisma: PrismaClient) {
    app.post('/api/push/register', async (req: FastifyRequest<{ Body: RegisterBody }>) => {
        const user = ensureUser(req);
        const { token, platform } = req.body ?? {};
        if (!token?.trim() || !platform?.trim()) {
            const err: any = new Error('token and platform required');
            err.statusCode = 400;
            throw err;
        }

        await prisma.pushDeviceToken.upsert({
            where: { token: token.trim() },
            update: { userId: user.id, platform: platform.trim() },
            create: { userId: user.id, token: token.trim(), platform: platform.trim() },
        });

        return { ok: true };
    });
}
