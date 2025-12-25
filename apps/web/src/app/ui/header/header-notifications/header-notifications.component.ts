import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, BellIcon, CheckIcon, Trash2Icon } from 'lucide-angular';

@Component({
    standalone: true,
    selector: 'header-notifications',
    imports: [CommonModule, RouterLink, LucideAngularModule],
    templateUrl: './header-notifications.component.html',
    styles: [`
        .pill {
            background: rgba(255, 255, 255, .2);
            border-radius: .375rem;
            padding: .25rem .5rem;
        }
        .menu-content {
            position: absolute;
            right: 0;
            top: 100%;
            min-width: 220px;
            background: #fff;
            color: #172b4d;
            border-radius: .5rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, .2);
            padding: .5rem;
            z-index: 100;
        }
    `]
})
export class HeaderNotificationsComponent {
    unreadCount = input.required<number>();
    notifications = input.required<any[]>();

    markAsRead = output<string>();
    deleteNotification = output<string>();
    markAllAsRead = output<void>();

    isOpen = signal(false);

    readonly BellIcon = BellIcon;
    readonly CheckIcon = CheckIcon;
    readonly Trash2Icon = Trash2Icon;
    readonly tNotifications = $localize`:@@header.notifications.title:Notifications`;
    readonly tMarkAllRead = $localize`:@@header.notifications.markAll:Mark all as read`;
    readonly tNoNotifications = $localize`:@@header.notifications.none:No new notifications`;
    readonly tMarkRead = $localize`:@@header.notifications.markRead:Mark as read`;
    readonly tDelete = $localize`:@@header.notifications.delete:Delete`;

    toggle() {
        this.isOpen.update(v => !v);
    }

    close() {
        this.isOpen.set(false);
    }

    onBlur(ev: FocusEvent) {
        const next = ev.relatedTarget as HTMLElement | null;
        if (!next || !(ev.currentTarget as HTMLElement).contains(next)) {
            this.close();
        }
    }

    getNotificationRoute(notification: any): string[] {
        if (notification.cardId && notification.boardId) {
            return ['/b', notification.boardId];
        }
        if (notification.boardId) {
            return ['/b', notification.boardId];
        }
        return ['/'];
    }
}
