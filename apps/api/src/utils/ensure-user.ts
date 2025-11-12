import type { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

type JwtPayload = { sub: string; email: string };

export function ensureUser(req: FastifyRequest) {
    // If some plugin already set req.user, reuse it
    if ((req as any).user?.id) return (req as any).user as { id: string; email?: string };

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
        const err: any = new Error('Unauthorized');
        err.statusCode = 401;
        throw err;
    }

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
        const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
        const user = { id: payload.sub, email: payload.email };
        (req as any).user = user; // cache for the rest of the pipeline
        return user;
    } catch {
        const err: any = new Error('Unauthorized');
        err.statusCode = 401;
        throw err;
    }
}
