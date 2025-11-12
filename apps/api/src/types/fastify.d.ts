import 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        user?: { id: string }; // set by your auth hook/plugin
    }
}