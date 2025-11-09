// apps/api/src/lib/authz.ts
import { PrismaClient, Role } from '@prisma/client';
import type { FastifyRequest, FastifyReply } from 'fastify';

const prisma = new PrismaClient();

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
    if (!(req as any).user) return reply.code(401).send({ error: 'Unauthorized' });
}

export async function isBoardMember(userId: string, boardId: string) {
    const m = await prisma.boardMember.findFirst({ where: { userId, boardId } });
    return !!m;
}

export async function requireBoardRole(
    req: FastifyRequest,
    reply: FastifyReply,
    boardId: string,
    roles: Role[] // allowed roles
) {
    const userId = (req as any).user?.id as string;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const m = await prisma.boardMember.findFirst({ where: { userId, boardId } });
    if (!m) return reply.code(403).send({ error: 'Not a member' });
    if (!roles.includes(m.role)) return reply.code(403).send({ error: 'Insufficient role' });
}
