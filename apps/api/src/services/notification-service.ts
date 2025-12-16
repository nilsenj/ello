// Centralized notification service
import { PrismaClient, NotificationType } from '@prisma/client';
import { emitToUser } from '../socket.js';

export class NotificationService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Create and emit a notification
     */
    private async createNotification(data: {
        userId: string;
        actorId?: string;
        type: NotificationType;
        title: string;
        message?: string;
        cardId?: string;
        boardId?: string;
        metadata?: any;
    }) {
        console.log(`[NotificationService] Creating notification for user ${data.userId} (Type: ${data.type})`);

        const notification = await this.prisma.notification.create({
            data: {
                userId: data.userId,
                actorId: data.actorId,
                type: data.type,
                title: data.title,
                message: data.message,
                cardId: data.cardId,
                boardId: data.boardId,
                metadata: data.metadata || undefined
            },
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
            }
        });

        // Emit real-time notification
        console.log(`[NotificationService] Emitting notification:new to user ${data.userId}`);
        emitToUser(data.userId, 'notification:new', notification);

        return notification;
    }

    /**
     * Notify user when mentioned in a comment
     */
    async notifyMention(params: {
        mentionedUserId: string;
        actorId: string;
        cardId: string;
        commentId: string;
        commentText?: string;
    }) {
        // Don't notify if user mentions themselves
        if (params.mentionedUserId === params.actorId) return;

        const card = await this.prisma.card.findUnique({
            where: { id: params.cardId },
            include: { list: { include: { board: true } } }
        });

        if (!card) return;

        const actor = await this.prisma.user.findUnique({
            where: { id: params.actorId },
            select: { name: true }
        });

        return this.createNotification({
            userId: params.mentionedUserId,
            actorId: params.actorId,
            type: 'MENTIONED',
            title: `${actor?.name || 'Someone'} mentioned you in "${card.title}"`,
            message: params.commentText,
            cardId: params.cardId,
            boardId: card.list.boardId,
            metadata: {
                commentId: params.commentId,
                listId: card.listId
            }
        });
    }

    /**
     * Notify user when assigned to a card
     */
    async notifyCardAssignment(params: {
        assigneeId: string;
        actorId: string;
        cardId: string;
    }) {
        // Don't notify if user assigns themselves
        if (params.assigneeId === params.actorId) return;

        const card = await this.prisma.card.findUnique({
            where: { id: params.cardId },
            include: { list: { include: { board: true } } }
        });

        if (!card) return;

        const actor = await this.prisma.user.findUnique({
            where: { id: params.actorId },
            select: { name: true }
        });

        return this.createNotification({
            userId: params.assigneeId,
            actorId: params.actorId,
            type: 'ASSIGNED_TO_CARD',
            title: `${actor?.name || 'Someone'} assigned you to "${card.title}"`,
            cardId: params.cardId,
            boardId: card.list.boardId,
            metadata: {
                listId: card.listId
            }
        });
    }

    /**
     * Notify watchers when a comment is added to a card
     */
    async notifyCardComment(params: {
        cardId: string;
        actorId: string;
        commentId: string;
        commentText?: string;
    }) {
        const card = await this.prisma.card.findUnique({
            where: { id: params.cardId },
            include: {
                list: { include: { board: true } },
                assignees: { select: { userId: true } },
                watchedBy: { select: { userId: true } }
            }
        });

        if (!card) return;

        const actor = await this.prisma.user.findUnique({
            where: { id: params.actorId },
            select: { name: true }
        });

        // Get unique user IDs (assignees + watchers, excluding the actor)
        const userIds = new Set<string>([
            ...card.assignees.map(a => a.userId),
            ...card.watchedBy.map(w => w.userId)
        ]);
        userIds.delete(params.actorId); // Don't notify the actor

        // Create notifications for each user
        const notifications = await Promise.all(
            Array.from(userIds).map(userId =>
                this.createNotification({
                    userId,
                    actorId: params.actorId,
                    type: 'CARD_COMMENT',
                    title: `${actor?.name || 'Someone'} commented on "${card.title}"`,
                    message: params.commentText,
                    cardId: params.cardId,
                    boardId: card.list.boardId,
                    metadata: {
                        commentId: params.commentId,
                        listId: card.listId
                    }
                })
            )
        );

        return notifications;
    }

    /**
     * Notify watchers when a card is moved
     */
    async notifyCardMove(params: {
        cardId: string;
        actorId: string;
        fromListId: string;
        toListId: string;
    }) {
        const card = await this.prisma.card.findUnique({
            where: { id: params.cardId },
            include: {
                list: { include: { board: true } },
                watchedBy: { select: { userId: true } }
            }
        });

        if (!card || card.watchedBy.length === 0) return;

        const [actor, fromList, toList] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: params.actorId },
                select: { name: true }
            }),
            this.prisma.list.findUnique({
                where: { id: params.fromListId },
                select: { name: true }
            }),
            this.prisma.list.findUnique({
                where: { id: params.toListId },
                select: { name: true }
            })
        ]);

        // Notify watchers (excluding the actor)
        const notifications = await Promise.all(
            card.watchedBy
                .filter(w => w.userId !== params.actorId)
                .map(watcher =>
                    this.createNotification({
                        userId: watcher.userId,
                        actorId: params.actorId,
                        type: 'CARD_MOVED',
                        title: `${actor?.name || 'Someone'} moved "${card.title}"`,
                        message: `From "${fromList?.name}" to "${toList?.name}"`,
                        cardId: params.cardId,
                        boardId: card.list.boardId,
                        metadata: {
                            fromListId: params.fromListId,
                            toListId: params.toListId,
                            fromListName: fromList?.name,
                            toListName: toList?.name
                        }
                    })
                )
        );

        return notifications;
    }

    /**
     * Notify user when added to a board
     */
    async notifyBoardInvite(params: {
        userId: string;
        actorId: string;
        boardId: string;
    }) {
        if (params.userId === params.actorId) return;

        const [board, actor] = await Promise.all([
            this.prisma.board.findUnique({
                where: { id: params.boardId },
                select: { name: true }
            }),
            this.prisma.user.findUnique({
                where: { id: params.actorId },
                select: { name: true }
            })
        ]);

        if (!board) return;

        return this.createNotification({
            userId: params.userId,
            actorId: params.actorId,
            type: 'ADDED_TO_BOARD',
            title: `${actor?.name || 'Someone'} added you to "${board.name}"`,
            boardId: params.boardId
        });
    }

    /**
     * Notify user when added to a workspace
     */
    async notifyWorkspaceInvite(params: {
        userId: string;
        actorId: string;
        workspaceId: string;
    }) {
        if (params.userId === params.actorId) return;

        const [workspace, actor] = await Promise.all([
            this.prisma.workspace.findUnique({
                where: { id: params.workspaceId },
                select: { name: true }
            }),
            this.prisma.user.findUnique({
                where: { id: params.actorId },
                select: { name: true }
            })
        ]);

        if (!workspace) return;

        return this.createNotification({
            userId: params.userId,
            actorId: params.actorId,
            type: 'ADDED_TO_WORKSPACE',
            title: `${actor?.name || 'Someone'} added you to workspace "${workspace.name}"`,
            metadata: { workspaceId: params.workspaceId }
        });
    }
}
