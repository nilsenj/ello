import fp from 'fastify-plugin';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type {FastifyInstance, FastifyPluginAsync, FastifyRequest} from 'fastify';
import {PrismaClient} from '@prisma/client';

type JwtPayload = { sub: string; email: string };

declare module 'fastify' {
    interface FastifyRequest {
        user?: { id: string; email: string };
    }
}

const authPlugin: FastifyPluginAsync<{
    prisma?: PrismaClient;
}> = async (app: FastifyInstance, opts) => {
    const prisma = opts.prisma ?? new PrismaClient();

    const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me';
    const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';
    const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

    function signAccess(user: { id: string; email: string }) {
        // @ts-ignore
        return jwt.sign({sub: user.id, email: user.email}, ACCESS_SECRET, {expiresIn: ACCESS_EXPIRES});
    }

    function signRefresh(user: { id: string; email: string }) {
        // @ts-ignore
        const token = jwt.sign({sub: user.id, email: user.email}, REFRESH_SECRET, {expiresIn: REFRESH_EXPIRES});
        return token;
    }

    async function verifyAccess(req: FastifyRequest) {
        const header = req.headers.authorization || '';
        const [, token] = header.split(' ');
        if (!token) return null;
        try {
            const p = jwt.verify(token, ACCESS_SECRET) as JwtPayload;
            return {id: p.sub, email: p.email};
        } catch {
            return null;
        }
    }

    // Decorator: attach req.user if access token is valid
    app.addHook('preHandler', async (req) => {
        const u = await verifyAccess(req);
        if (u) req.user = u;
    });

    // --- Routes ---

    app.post('/api/auth/register', async (req, reply) => {
        const {email, password, name} = (req.body as any) ?? {};
        if (!email || !password) return reply.code(400).send({error: 'email & password required'});

        const exists = await prisma.user.findUnique({where: {email}});
        if (exists) return reply.code(409).send({error: 'email already registered'});

        const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 12));
        const user = await prisma.user.create({data: {email, name, password: hash}});

        // optional: add to demo board/workspace in your seed flow

        const accessToken = signAccess(user);
        const refreshToken = signRefresh(user);

        // persist refresh token
        const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // mirror REFRESH_EXPIRES if you want
        await prisma.refreshToken.create({data: {token: refreshToken, userId: user.id, expiresAt}});

        return {accessToken, refreshToken, user: {id: user.id, email: user.email, name: user.name}};
    });

    app.post('/api/auth/login', async (req, reply) => {
        const {email, password} = (req.body as any) ?? {};
        if (!email || !password) return reply.code(400).send({error: 'email & password required'});

        const user = await prisma.user.findUnique({where: {email}});
        if (!user) return reply.code(401).send({error: 'invalid credentials'});

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return reply.code(401).send({error: 'invalid credentials'});

        const accessToken = signAccess(user);
        const refreshToken = signRefresh(user);
        const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

        await prisma.refreshToken.create({data: {token: refreshToken, userId: user.id, expiresAt}});

        return {accessToken, refreshToken, user: {id: user.id, email: user.email, name: user.name}};
    });

    app.post('/api/auth/refresh', async (req, reply) => {
        const {refreshToken} = (req.body as any) ?? {};
        if (!refreshToken) return reply.code(400).send({error: 'refreshToken required'});

        const inDb = await prisma.refreshToken.findUnique({where: {token: refreshToken}});
        if (!inDb || inDb.expiresAt < new Date()) return reply.code(401).send({error: 'invalid refresh token'});

        let payload: JwtPayload;
        try {
            payload = jwt.verify(refreshToken, REFRESH_SECRET) as JwtPayload;
        } catch {
            // revoke on parse error
            await prisma.refreshToken.delete({where: {token: refreshToken}}).catch(() => {
            });
            return reply.code(401).send({error: 'invalid refresh token'});
        }

        const user = await prisma.user.findUnique({where: {id: payload.sub}});
        if (!user) return reply.code(401).send({error: 'user not found'});

        // rotate
        await prisma.refreshToken.delete({where: {token: refreshToken}}).catch(() => {
        });
        const nextRefresh = signRefresh(user);
        const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
        await prisma.refreshToken.create({data: {token: nextRefresh, userId: user.id, expiresAt}});

        const accessToken = signAccess(user);
        return {accessToken, refreshToken: nextRefresh};
    });

    app.post('/api/auth/logout', async (req, reply) => {
        const {refreshToken} = (req.body as any) ?? {};
        if (refreshToken) {
            await prisma.refreshToken.delete({where: {token: refreshToken}}).catch(() => {
            });
        }
        return reply.code(204).send();
    });
};

export default fp(authPlugin, {name: 'auth-plugin'});
