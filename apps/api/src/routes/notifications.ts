// Notification API routes
import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ensureUser } from '../utils/ensure-user.js';

export async function registerNotificationRoutes(app: FastifyInstance, prisma: PrismaClient) {
    // Get user's notifications (paginated)
    app.get<{
        Querystring: { limit?: string; offset?: string }
    }>('/api/notifications', async (req) => {
        const user = ensureUser(req);
        const limit = parseInt(req.query.limit || '20');
        const offset = parseInt(req.query.offset || '0');

        const notifications = await prisma.notification.findMany({
            where: { userId: user.id },
            include: {
                actor: {
                    select: { id: true, name: true, avatar: true }
                },
                card: {
                    select: { id: true, title: true }
                },
                board: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });

        return notifications;
    });

    // Get unread notification count
    app.get('/api/notifications/unread/count', async (req) => {
        const user = ensureUser(req);

        const count = await prisma.notification.count({
            where: {
                userId: user.id,
                isRead: false
            }
        });

        return { count };
    });

    // Mark notification as read
    app.patch<{
        Params: { id: string }
    }>('/api/notifications/:id/read', async (req, reply) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const notification = await prisma.notification.findUnique({
            where: { id }
        });

        if (!notification || notification.userId !== user.id) {
            return reply.code(404).send({ error: 'Notification not found' });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });

        return updated;
    });

    // Mark all notifications as read
    app.patch('/api/notifications/read-all', async (req) => {
        const user = ensureUser(req);

        await prisma.notification.updateMany({
            where: {
                userId: user.id,
                isRead: false
            },
            data: { isRead: true }
        });

        return { ok: true };
    });

    // Delete a notification
    app.delete<{
        Params: { id: string }
    }>('/api/notifications/:id', async (req, reply) => {
        const user = ensureUser(req);
        const { id } = req.params;

        const notification = await prisma.notification.findUnique({
            where: { id }
        });

        if (!notification || notification.userId !== user.id) {
            return reply.code(404).send({ error: 'Notification not found' });
        }

        await prisma.notification.delete({
            where: { id }
        });

        return { ok: true };
    });
}
