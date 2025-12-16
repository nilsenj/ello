import { Injectable } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { AppNotification } from './notification.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
    providedIn: 'root'
})
export class NotificationsService {
    constructor(private api: ApiBaseService) { }

    /** Дістаємо токен без DI, щоб не створювати цикл */
    private get authHeaders(): HttpHeaders {
        const token = localStorage.getItem('accessToken');
        return token
            ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
            : new HttpHeaders();
    }

    getNotifications(limit = 20, offset = 0): Observable<AppNotification[]> {
        return from(
            this.api.get<AppNotification[]>(`/api/notifications?limit=${limit}&offset=${offset}`, {
                headers: this.authHeaders,
            }),
        );
    }

    getUnreadCount(): Observable<{ count: number }> {
        return from(
            this.api.get<{ count: number }>('/api/notifications/unread/count', {
                headers: this.authHeaders,
            }),
        );
    }

    markAsRead(notificationId: string): Observable<AppNotification> {
        return from(
            this.api.patch<AppNotification>(
                `/api/notifications/${notificationId}/read`,
                {},
                { headers: this.authHeaders },
            ),
        );
    }

    markAllAsRead(): Observable<{ ok: boolean }> {
        return from(
            this.api.patch<{ ok: boolean }>(
                '/api/notifications/read-all',
                {},
                { headers: this.authHeaders },
            ),
        );
    }

    deleteNotification(notificationId: string): Observable<{ ok: boolean }> {
        return from(
            this.api.delete<{ ok: boolean }>(`/api/notifications/${notificationId}`, {
                headers: this.authHeaders,
            }),
        );
    }
}
