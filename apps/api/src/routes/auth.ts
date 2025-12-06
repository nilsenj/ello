import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

type JwtPayload = { sub: string; email: string };
const ACCESS_TTL_SEC = 60 * 15;          // 15m
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30d
const RT_COOKIE = 'rt';

export async function registerAuthRoutes(app: FastifyInstance, prisma: PrismaClient) {
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
    const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

    const signAccess = (u: { id: string; email: string }) =>
        jwt.sign({ sub: u.id, email: u.email } as JwtPayload, JWT_SECRET, { expiresIn: ACCESS_TTL_SEC });

    function setRefreshCookie(reply: any, token: string, maxAgeMs: number) {
        reply.setCookie(RT_COOKIE, token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false, // set true in prod with HTTPS
            path: '/api/auth',
            maxAge: Math.floor(maxAgeMs / 1000),
        });
    }

    // POST /api/auth/register
    app.post('/api/auth/register', async (req: FastifyRequest<{ Body: { email: string; name?: string; password: string } }>, reply) => {
        const { email, name, password } = req.body || ({} as any);
        if (!email || !password) return reply.code(400).send({ error: 'email and password are required' });

        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const user = await prisma.user.create({ data: { email, name, password: hash } });

        // Check for pending invitations
        const pendingInvites = await prisma.pendingInvitation.findMany({ where: { email } });
        for (const invite of pendingInvites) {
            // Add to workspace
            try {
                await prisma.workspaceMember.create({
                    data: {
                        workspaceId: invite.workspaceId,
                        userId: user.id,
                        role: invite.role
                    }
                });

                // Add to board if specified
                if (invite.boardId) {
                    await prisma.boardMember.create({
                        data: {
                            boardId: invite.boardId,
                            userId: user.id,
                            role: invite.role
                        }
                    });
                }

                // Delete invitation
                await prisma.pendingInvitation.delete({ where: { id: invite.id } });
            } catch (err) {
                console.error('Failed to process pending invitation', err);
            }
        }

        // dev UX: auto-issue tokens on register
        const accessToken = signAccess(user);
        const refreshToken = `rt_${user.id}_${Date.now()}`;
        const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
        await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });
        setRefreshCookie(reply, refreshToken, REFRESH_TTL_MS);

        return { accessToken, user: { id: user.id, email: user.email, name: user.name ?? undefined } };
    });

    // POST /api/auth/login
    app.post('/api/auth/login', async (req: FastifyRequest<{ Body: { email: string; password: string } }>, reply) => {
        const { email, password } = req.body || ({} as any);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return reply.code(401).send({ error: 'Invalid credentials' });
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });

        const accessToken = signAccess(user);
        const refreshToken = `rt_${user.id}_${Date.now()}`;
        const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
        await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });
        setRefreshCookie(reply, refreshToken, REFRESH_TTL_MS);

        return { accessToken, user: { id: user.id, email: user.email, name: user.name ?? undefined, avatar: user.avatar ?? undefined } };
    });

    // POST /api/auth/logout
    app.post('/api/auth/logout', async (req, reply) => {
        const rt = (req.cookies?.[RT_COOKIE] as string | undefined) ?? '';
        if (rt) await prisma.refreshToken.deleteMany({ where: { token: rt } });
        reply.clearCookie(RT_COOKIE, { path: '/api/auth' });
        return { ok: true };
    });

    // POST /api/auth/refresh  → reads httpOnly cookie, returns new accessToken
    app.post('/api/auth/refresh', async (req, reply) => {
        const rt = (req.cookies?.[RT_COOKIE] as string | undefined) ?? '';
        if (!rt) return reply.code(400).send({ error: 'No refresh token' });

        const row = await prisma.refreshToken.findUnique({ where: { token: rt }, include: { user: true } });
        if (!row || !row.user || row.expiresAt < new Date()) {
            return reply.code(400).send({ error: 'Invalid refresh token' });
        }
        const accessToken = signAccess(row.user);
        return { accessToken };
    });

    // GET /api/auth/me  → requires Authorization: Bearer <access>
    app.get('/api/auth/me', async (req, reply) => {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return reply.code(401).send({ error: 'No token' });
        try {
            const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
            const user = await prisma.user.findUnique({ where: { id: payload.sub } });
            if (!user) return reply.code(401).send({ error: 'User not found' });
            return { id: user.id, email: user.email, name: user.name ?? undefined, avatar: user.avatar ?? undefined };
        } catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }
    });

    // PATCH /api/auth/me
    app.patch('/api/auth/me', async (req: FastifyRequest<{ Body: { name?: string; avatar?: string; password?: string } }>, reply) => {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!token) return reply.code(401).send({ error: 'No token' });

        let userId: string;
        try {
            const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
            userId = payload.sub;
        } catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }

        const { name, avatar, password } = req.body || {};
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (avatar !== undefined) data.avatar = avatar;
        if (password) {
            data.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, email: true, name: true, avatar: true }
        });

        return updated;
    });
}
