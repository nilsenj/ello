import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient, BillingProvider, BillingStatus } from '@prisma/client';
import { ensureUser } from '../utils/ensure-user.js';

type ListQuery = { q?: string; take?: string; skip?: string };

type BanBody = {
    banned: boolean;
    reason?: string | null;
};

type TransactionsQuery = {
    q?: string;
    workspaceId?: string;
    status?: BillingStatus;
    provider?: BillingProvider;
    take?: string;
    skip?: string;
};

async function ensureSuperAdmin(prisma: PrismaClient, userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isSuperAdmin: true },
    });
    if (!user?.isSuperAdmin) {
        const err: any = new Error('Forbidden');
        err.statusCode = 403;
        throw err;
    }
}

function clampTake(take?: string, max = 100) {
    const n = Number(take ?? 0);
    if (!Number.isFinite(n) || n <= 0) return 50;
    return Math.min(n, max);
}

export async function registerAdminRoutes(app: FastifyInstance, prisma: PrismaClient) {
    app.get('/api/admin/users', async (req: FastifyRequest<{ Querystring: ListQuery }>) => {
        const user = ensureUser(req);
        await ensureSuperAdmin(prisma, user.id);

        const { q, take, skip } = req.query || {};
        const users = await prisma.user.findMany({
            where: q
                ? {
                      OR: [
                          { email: { contains: q, mode: 'insensitive' } },
                          { name: { contains: q, mode: 'insensitive' } },
                      ],
                  }
                : undefined,
            take: clampTake(take),
            skip: Number(skip ?? 0) || 0,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                name: true,
                isBanned: true,
                bannedAt: true,
                banReason: true,
                isSuperAdmin: true,
                createdAt: true,
                _count: { select: { workspaces: true } },
            },
        });

        return {
            users: users.map((u) => ({
                ...u,
                workspacesCount: u._count.workspaces,
            })),
        };
    });

    app.patch('/api/admin/users/:userId/ban', async (
        req: FastifyRequest<{ Params: { userId: string }; Body: BanBody }>,
        reply
    ) => {
        const user = ensureUser(req);
        await ensureSuperAdmin(prisma, user.id);

        const { userId } = req.params;
        const { banned, reason } = req.body || { banned: false };
        if (typeof banned !== 'boolean') {
            return reply.code(400).send({ error: 'banned must be boolean' });
        }

        const target = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, isSuperAdmin: true },
        });
        if (!target) {
            return reply.code(404).send({ error: 'User not found' });
        }
        if (banned && target.isSuperAdmin) {
            return reply.code(403).send({ error: 'Cannot ban super admin' });
        }
        if (banned && userId === user.id) {
            return reply.code(400).send({ error: 'Cannot ban yourself' });
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                isBanned: banned,
                bannedAt: banned ? new Date() : null,
                banReason: banned ? (reason || null) : null,
            },
            select: {
                id: true,
                email: true,
                name: true,
                isBanned: true,
                bannedAt: true,
                banReason: true,
                isSuperAdmin: true,
                createdAt: true,
            },
        });

        if (banned) {
            await prisma.refreshToken.deleteMany({ where: { userId } });
        }

        return { user: updated };
    });

    app.get('/api/admin/workspaces', async (req: FastifyRequest<{ Querystring: ListQuery }>) => {
        const user = ensureUser(req);
        await ensureSuperAdmin(prisma, user.id);

        const { q, take, skip } = req.query || {};
        const workspaces = await prisma.workspace.findMany({
            where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
            take: clampTake(take),
            skip: Number(skip ?? 0) || 0,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { members: true, boards: true } },
                members: {
                    where: { role: 'owner' },
                    include: { user: { select: { email: true, name: true } } },
                },
            },
        });

        return {
            workspaces: workspaces.map((ws) => ({
                id: ws.id,
                name: ws.name,
                isPersonal: ws.isPersonal,
                planKey: ws.planKey,
                createdAt: ws.createdAt,
                membersCount: ws._count.members,
                boardsCount: ws._count.boards,
                owners: ws.members.map((m) => m.user),
            })),
        };
    });

    app.delete('/api/admin/workspaces/:workspaceId', async (
        req: FastifyRequest<{ Params: { workspaceId: string } }>,
        reply
    ) => {
        const user = ensureUser(req);
        await ensureSuperAdmin(prisma, user.id);

        const { workspaceId } = req.params;
        await prisma.workspace.delete({ where: { id: workspaceId } });
        return reply.send({ ok: true });
    });

    app.get('/api/admin/billing/transactions', async (
        req: FastifyRequest<{ Querystring: TransactionsQuery }>
    ) => {
        const user = ensureUser(req);
        await ensureSuperAdmin(prisma, user.id);

        const { q, workspaceId, status, provider, take, skip } = req.query || {};
        const transactions = await prisma.billingTransaction.findMany({
            where: {
                ...(workspaceId ? { workspaceId } : {}),
                ...(status ? { status } : {}),
                ...(provider ? { provider } : {}),
                ...(q
                    ? {
                          OR: [
                              { orderId: { contains: q, mode: 'insensitive' } },
                              { planKey: { contains: q, mode: 'insensitive' } },
                              { workspace: { name: { contains: q, mode: 'insensitive' } } },
                          ],
                      }
                    : {}),
            },
            take: clampTake(take),
            skip: Number(skip ?? 0) || 0,
            orderBy: { createdAt: 'desc' },
            include: {
                workspace: { select: { id: true, name: true } },
            },
        });

        return {
            transactions: transactions.map((t) => ({
                id: t.id,
                workspaceId: t.workspaceId,
                workspaceName: t.workspace?.name ?? null,
                planKey: t.planKey,
                provider: t.provider,
                status: t.status,
                amount: t.amount,
                currency: t.currency,
                orderId: t.orderId,
                createdAt: t.createdAt,
            })),
        };
    });
}
