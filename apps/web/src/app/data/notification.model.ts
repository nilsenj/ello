// Notification data models
export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
    isRead: boolean;
    userId: string;
    actorId?: string;
    cardId?: string;
    boardId?: string;
    metadata?: any;
    createdAt: string;

    // Included relations
    actor?: {
        id: string;
        name: string;
        avatar?: string;
    };
    card?: {
        id: string;
        title: string;
    };
    board?: {
        id: string;
        name: string;
    };
}

export type NotificationType =
    | 'MENTIONED'
    | 'ASSIGNED_TO_CARD'
    | 'CARD_COMMENT'
    | 'CARD_DUE_SOON'
    | 'CARD_MOVED'
    | 'ADDED_TO_BOARD'
    | 'ADDED_TO_WORKSPACE';
