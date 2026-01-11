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
    const IS_PROD = process.env.NODE_ENV === 'production';

    const signAccess = (u: { id: string; email: string }) =>
        jwt.sign({ sub: u.id, email: u.email } as JwtPayload, JWT_SECRET, { expiresIn: ACCESS_TTL_SEC });

    function setRefreshCookie(reply: any, token: string, maxAgeMs: number) {
        const cookieSameSite = (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none' | undefined)
            ?? (IS_PROD ? 'none' : 'lax');
        const cookieSecure = process.env.COOKIE_SECURE
            ? process.env.COOKIE_SECURE === 'true'
            : IS_PROD;
        reply.setCookie(RT_COOKIE, token, {
            httpOnly: true,
            sameSite: cookieSameSite,
            secure: cookieSecure,
            path: '/api/auth',
            maxAge: Math.floor(maxAgeMs / 1000),
        });
    }

    // POST /api/auth/register
    app.post('/api/auth/register', async (req: FastifyRequest<{ Body: { email: string; name?: string; password: string } }>, reply) => {
        const { email, name, password } = req.body || ({} as any);
        if (!email || !password) return reply.code(400).send({ error: 'email and password are required' });

        // Check for existing user (e.g. shadow user from invitation)
        const existingUser = await prisma.user.findUnique({ where: { email } });
        let user;

        if (existingUser) {
            if (existingUser.isPending) {
                // Claim shadow account
                const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
                user = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        name: name || existingUser.name,
                        password: hash,
                        isPending: false
                    }
                });
            } else {
                return reply.code(400).send({ error: 'User already exists' });
            }
        } else {
            const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
            user = await prisma.user.create({ data: { email, name, password: hash } });
        }

        // Auto-create Personal Workspace
        let baseName = name ? `${name} Workspace` : 'Personal Workspace';
        let workspaceName = baseName;
        let counter = 1;

        // Ensure unique workspace name
        // Limit attempts to avoid infinite loops in pathological cases
        while ((await prisma.workspace.findUnique({ where: { name: workspaceName } })) && counter < 100) {
            workspaceName = `${baseName} ${counter}`;
            counter++;
        }

        const personalWorkspace = await prisma.workspace.create({
            data: {
                name: workspaceName,
                isPersonal: true,
                members: {
                    create: { userId: user.id, role: 'owner' }
                }
            }
        });

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

        return {
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email, name: user.name ?? undefined, isSuperAdmin: user.isSuperAdmin ?? false },
        };
    });

    // POST /api/auth/login
    app.post('/api/auth/login', async (req: FastifyRequest<{ Body: { email: string; password: string } }>, reply) => {
        const { email, password } = req.body || ({} as any);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return reply.code(401).send({ error: 'Invalid credentials' });
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });
        if (user.isBanned) return reply.code(403).send({ error: 'Account is disabled' });

        const accessToken = signAccess(user);
        const refreshToken = `rt_${user.id}_${Date.now()}`;
        const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
        await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });
        setRefreshCookie(reply, refreshToken, REFRESH_TTL_MS);

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name ?? undefined,
                avatar: user.avatar ?? undefined,
                isSuperAdmin: user.isSuperAdmin ?? false,
            },
        };
    });

    // POST /api/auth/logout
    app.post('/api/auth/logout', async (req: FastifyRequest<{ Body?: { refreshToken?: string } }>, reply) => {
        const rt = (req.cookies?.[RT_COOKIE] as string | undefined)
            ?? (req.body?.refreshToken as string | undefined)
            ?? '';
        if (rt) await prisma.refreshToken.deleteMany({ where: { token: rt } });
        reply.clearCookie(RT_COOKIE, { path: '/api/auth' });
        return { ok: true };
    });

    // POST /api/auth/refresh  → reads httpOnly cookie, returns new accessToken
    app.post('/api/auth/refresh', async (req: FastifyRequest<{ Body?: { refreshToken?: string } }>, reply) => {
        const rt = (req.cookies?.[RT_COOKIE] as string | undefined)
            ?? (req.body?.refreshToken as string | undefined)
            ?? '';
        if (!rt) return reply.code(400).send({ error: 'No refresh token' });

        const row = await prisma.refreshToken.findUnique({ where: { token: rt }, include: { user: true } });
        if (!row || !row.user || row.expiresAt < new Date()) {
            return reply.code(400).send({ error: 'Invalid refresh token' });
        }
        if (row.user.isBanned) {
            await prisma.refreshToken.deleteMany({ where: { userId: row.user.id } });
            return reply.code(403).send({ error: 'Account is disabled' });
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
            if (user.isBanned) return reply.code(403).send({ error: 'Account is disabled' });
            return {
                id: user.id,
                email: user.email,
                name: user.name ?? undefined,
                avatar: user.avatar ?? undefined,
                isSuperAdmin: user.isSuperAdmin ?? false,
            };
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
