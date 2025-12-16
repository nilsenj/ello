import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiBaseService } from '../data/api-base.service';
import { SocketService } from '../data/socket.service';
import { NotificationsStore } from '../data/notifications-store.service';

type User = { id: string; email: string; name?: string; avatar?: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
    private api = inject(ApiBaseService);
    private http = inject(HttpClient);
    private socketService = inject(SocketService);
    private notificationsStore = inject(NotificationsStore);

    private _user = signal<User | null>(null);
    private _access = signal<string | null>(localStorage.getItem('accessToken'));
    private _bootstrapped = signal(false);

    user = computed(() => this._user());
    isAuthed = computed(() => !!this._access() && !!this._user());

    /** Call once in app bootstrap or AppComponent */
    async bootstrap() {
        if (!this._access()) { this._bootstrapped.set(true); return; }
        try {
            const me = await this.api.get<User>('/api/auth/me');
            this._user.set(me ?? null);
            if (me?.id) localStorage.setItem('userId', me.id); // ✅ keep for UI helpers

            // Connect Socket.IO and load notifications
            if (me && this._access()) {
                this.socketService.connect(this._access()!);
                await this.notificationsStore.loadNotifications();
            }
        } catch {
            await this.tryRefresh(); // has withCredentials: true
        } finally {
            this._bootstrapped.set(true);
        }
    }

    // Small helper the guard can await
    ensureBootstrapped(): Promise<void> {
        return this._bootstrapped() ? Promise.resolve() : this.bootstrap();
    }

    async register(payload: { email: string; name?: string; password: string }) {
        return this.api.post('/api/auth/register', payload);
    }

    async login(payload: { email: string; password: string }) {
        const res = await this.api.post<{
            accessToken: string; refreshToken?: string; user: User;
        }>('/api/auth/login', payload);

        if (res?.accessToken) {
            this._access.set(res.accessToken);
            localStorage.setItem('accessToken', res.accessToken);
        }
        this._user.set(res?.user ?? null);

        // Connect Socket.IO and load notifications after login
        if (res?.accessToken) {
            this.socketService.connect(res.accessToken);
            await this.notificationsStore.loadNotifications();
        }

        return res;
    }

    async logout() {
        try { await this.api.post('/api/auth/logout', {}); } catch { }
        this._user.set(null);
        this._access.set(null);
        localStorage.removeItem('accessToken');

        // Disconnect Socket.IO
        this.socketService.disconnect();
    }

    /** Automatically called by interceptor on 401 */
    // ⬇️ add withCredentials: true on refresh
    async tryRefresh(): Promise<boolean> {
        try {
            const res = await this.api
                .post<{ accessToken: string }>(
                    '/api/auth/refresh',
                    {}
                );

            if (res?.accessToken) {
                this._access.set(res.accessToken);
                localStorage.setItem('accessToken', res.accessToken);

                const me = await this.api.get<User>('/api/auth/me');
                this._user.set(me || null);

                // ⬇️ persist userId because your CardsService uses it in withUser()
                if (me?.id) localStorage.setItem('userId', me.id);

                // Connect Socket.IO and load notifications
                this.socketService.connect(res.accessToken);
                await this.notificationsStore.loadNotifications();

                return true;
            }
        } catch { }
        this._user.set(null);
        this._access.set(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userId');
        return false;
    }

    // Password reset flows
    requestPassword(email: string) {
        return this.api.post<{ ok: boolean; resetToken?: string }>(
            '/api/auth/password/request', { email }
        );
    }

    resetPassword(token: string, password: string) {
        return this.api.post('/api/auth/password/reset', { token, password });
    }

    async updateProfile(data: { name?: string; avatar?: string; password?: string }) {
        const updated = await this.api.patch<User>('/api/auth/me', data);
        if (updated) {
            this._user.set(updated);
        }
        return updated;
    }

    get accessToken() { return this._access(); }
    get bootstrapped() { return this._bootstrapped(); }
}
