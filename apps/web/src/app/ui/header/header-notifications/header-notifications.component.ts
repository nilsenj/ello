import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, BellIcon, CheckIcon, Trash2Icon } from 'lucide-angular';
import { ClickOutsideDirective } from '../../click-outside.directive';

@Component({
    standalone: true,
    selector: 'header-notifications',
    imports: [CommonModule, RouterLink, LucideAngularModule, ClickOutsideDirective],
    templateUrl: './header-notifications.component.html',
    styles: [`
        .pill {
            background: rgba(255, 255, 255, .2);
            border-radius: .375rem;
            padding: .25rem .5rem;
        }
        @media (max-width: 640px) {
            .mobile-dropdown {
                position: fixed;
                left: 50%;
                right: auto;
                top: calc(56px + env(safe-area-inset-top));
                transform: translateX(-50%);
                width: min(92vw, 22rem);
            }
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
