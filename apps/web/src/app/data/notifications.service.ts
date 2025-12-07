import { Injectable } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { environment } from '@env';
import { AppNotification } from './notification.model';
import { ApiBaseService } from './api-base.service';

@Injectable({
    providedIn: 'root'
})
export class NotificationsService {
    private apiUrl = environment.apiUrl || 'http://localhost:4200';

    constructor(private api: ApiBaseService) { }

    /** Дістаємо токен без DI, щоб не створювати цикл */
    private get authHeaders(): HttpHeaders {
        const token = localStorage.getItem('accessToken');
        return token
            ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
            : new HttpHeaders();
    }

    getNotifications(limit = 20, offset = 0): Observable<AppNotification[]> {
        const url = `${this.apiUrl}/api/notifications?limit=${limit}&offset=${offset}`;
        return from(
            this.api.get<AppNotification[]>(url, {
                headers: this.authHeaders,
            }),
        );
    }

    getUnreadCount(): Observable<{ count: number }> {
        const url = `${this.apiUrl}/api/notifications/unread/count`;
        return from(
            this.api.get<{ count: number }>(url, {
                headers: this.authHeaders,
            }),
        );
    }

    markAsRead(notificationId: string): Observable<AppNotification> {
        const url = `${this.apiUrl}/api/notifications/${notificationId}/read`;
        return from(
            this.api.patch<AppNotification>(
                url,
                {},
                { headers: this.authHeaders },
            ),
        );
    }

    markAllAsRead(): Observable<{ ok: boolean }> {
        const url = `${this.apiUrl}/api/notifications/read-all`;
        return from(
            this.api.patch<{ ok: boolean }>(
                url,
                {},
                { headers: this.authHeaders },
            ),
        );
    }

    deleteNotification(notificationId: string): Observable<{ ok: boolean }> {
        const url = `${this.apiUrl}/api/notifications/${notificationId}`;
        return from(
            this.api.delete<{ ok: boolean }>(url, {
                headers: this.authHeaders,
            }),
        );
    }
}
