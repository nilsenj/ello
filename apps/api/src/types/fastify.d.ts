import 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        user?: { id: string; email?: string; isSuperAdmin?: boolean }; // set by auth hook/plugin
    }

    interface FastifyInstance {
        prisma: import('@prisma/client').PrismaClient;
    }
}
