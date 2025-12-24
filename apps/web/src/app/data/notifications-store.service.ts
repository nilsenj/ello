// Notifications state store
import { computed, inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from './notifications.service';
import { SocketService } from './socket.service';
import { AppNotification } from './notification.model';
import { BoardsService } from './boards.service';
import { BoardStore } from '../store/board-store.service';

@Injectable({
    providedIn: 'root'
})
export class NotificationsStore {
    private socketService = inject(SocketService);
    private boardsApi = inject(BoardsService);
    private boardStore = inject(BoardStore);

    // State
    private notifications = signal<AppNotification[]>([]);
    private unreadCount = signal<number>(0);
    private loading = signal<boolean>(false);

    // Selectors
    readonly allNotifications = this.notifications.asReadonly();
    readonly unreadNotificationsCount = this.unreadCount.asReadonly();
    readonly isLoading = this.loading.asReadonly();

    readonly hasUnread = computed(() => this.unreadCount() > 0);

    constructor(private notificationsService: NotificationsService) {
        console.log('[NotificationsStore] Initializing...');
        console.log('[NotificationsStore] SocketService connected:', this.socketService);

        // Listen for real-time notifications
        this.socketService.on<AppNotification>('notification:new', (notification) => {
            console.log('[NotificationsStore] Received notification:', notification);
            const current = this.notifications();
            // Deduplicate: only add if not already present
            if (!current.find(n => n.id === notification.id)) {
                console.log('[NotificationsStore] Adding new notification');
                this.notifications.update(notifications => [notification, ...notifications]);
                this.unreadCount.update(count => count + 1);

                // Optional: Show browser notification
                this.showBrowserNotification(notification);
            } else {
                console.log('[NotificationsStore] Duplicate notification ignored');
            }
            void this.handleRealtimeSideEffects(notification);
        });

        console.log('[NotificationsStore] Event listener registered for notification:new');
    }

    private async handleRealtimeSideEffects(notification: AppNotification): Promise<void> {
        if (notification.type !== 'ADDED_TO_BOARD' || !notification.boardId) return;

        try {
            await this.boardsApi.loadBoards({ autoSelect: false });
        } catch (error) {
            console.error('Failed to refresh boards after board invite', error);
        }

        if (this.boardStore.currentBoardId() === notification.boardId) {
            try {
                const members = await this.boardsApi.searchMembers(notification.boardId);
                this.boardStore.setMembers(members);
            } catch (error) {
                console.error('Failed to refresh board members after board invite', error);
            }
        }
    }

    async loadNotifications(): Promise<void> {
        this.loading.set(true);
        try {
            const notifications = await this.notificationsService.getNotifications().toPromise();
            this.notifications.set(notifications || []);

            const { count } = await this.notificationsService.getUnreadCount().toPromise() || { count: 0 };
            this.unreadCount.set(count);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        } finally {
            this.loading.set(false);
        }
    }

    async markAsRead(notificationId: string): Promise<void> {
        try {
            await this.notificationsService.markAsRead(notificationId).toPromise();

            this.notifications.update(notifications =>
                notifications.map(n =>
                    n.id === notificationId ? { ...n, isRead: true } : n
                )
            );

            this.unreadCount.update(count => Math.max(0, count - 1));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }

    async markAllAsRead(): Promise<void> {
        try {
            await this.notificationsService.markAllAsRead().toPromise();

            this.notifications.update(notifications =>
                notifications.map(n => ({ ...n, isRead: true }))
            );

            this.unreadCount.set(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    }

    async deleteNotification(notificationId: string): Promise<void> {
        try {
            await this.notificationsService.deleteNotification(notificationId).toPromise();

            const wasUnread = this.notifications().find(n => n.id === notificationId)?.isRead === false;

            this.notifications.update(notifications =>
                notifications.filter(n => n.id !== notificationId)
            );

            if (wasUnread) {
                this.unreadCount.update(count => Math.max(0, count - 1));
            }
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    }

    private showBrowserNotification(notification: AppNotification): void {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/assets/logo.png'
            });
        }
    }

    requestBrowserNotificationPermission(): void {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
}
