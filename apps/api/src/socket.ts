// Socket.IO setup for real-time notifications
import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';

export interface SocketUser {
    id: string;
    email: string;
}

export let io: SocketIOServer;

export async function setupSocketIO(app: FastifyInstance, prisma: PrismaClient) {
    // Initialize Socket.IO server
    console.log('Initializing Socket.IO server...');
    io = new SocketIOServer(app.server, {
        cors: {
            origin: true, // Allow all origins (same as Fastify CORS)
            credentials: true // Enable credentials
        },
        path: '/socket.io/',
        transports: ['websocket', 'polling'], // Explicitly allow both transports
        allowEIO3: true // Enable Engine.IO v3 compatibility
    });

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;

            if (!token) {
                console.log('[Socket] Connection attempt without token');
                return next(new Error('Authentication token required'));
            }

            // Verify JWT token (reuse your existing JWT verification logic)
            const decoded = app.jwt.verify(token) as { sub?: string; id?: string; email: string };
            const userId = decoded.id ?? decoded.sub;
            if (!userId) {
                return next(new Error('Invalid token payload'));
            }
            console.log(`[Socket] User authenticated: ${decoded.email} (${userId})`);

            // Attach normalized user to socket
            socket.data.user = { id: userId, email: decoded.email };
            next();
        } catch (err) {
            console.error('[Socket] Authentication failed:', err);
            next(new Error('Invalid token'));
        }
    });

    // Connection handler
    io.on('connection', (socket) => {
        const user = socket.data.user as SocketUser;
        console.log(`[Socket] User connected: ${user.email} (${user.id})`);

        // Join user's personal notification room
        const userRoom = `user:${user.id}`;
        socket.join(userRoom);
        console.log(`[Socket] User ${user.id} joined room ${userRoom}`);

        // Handle board room subscriptions
        socket.on('subscribe:board', (boardId: string) => {
            console.log(`[Socket] User ${user.id} subscribed to board ${boardId}`);
            socket.join(`board:${boardId}`);
        });

        socket.on('unsubscribe:board', (boardId: string) => {
            console.log(`[Socket] User ${user.id} unsubscribed from board ${boardId}`);
            socket.leave(`board:${boardId}`);
        });

        // Disconnect handler
        socket.on('disconnect', () => {
            console.log(`[Socket] User disconnected: ${user.email}`);
        });
    });

    console.log('Socket.IO server initialized');
    return io;
}

// Helper function to emit to a user's room
export function emitToUser(userId: string, event: string, data: any) {
    if (!io) {
        console.error('[Socket] Socket.IO not initialized');
        return;
    }
    console.log(`[Socket] Emitting ${event} to user:${userId}`);
    const room = io.sockets.adapter.rooms.get(`user:${userId}`);
    console.log(`[Socket] Room user:${userId} has ${room?.size || 0} clients`);
    io.to(`user:${userId}`).emit(event, data);
}

// Helper function to emit to a board room
export function emitToBoard(boardId: string, event: string, data: any) {
    if (!io) {
        console.error('Socket.IO not initialized');
        return;
    }
    io.to(`board:${boardId}`).emit(event, data);
}
