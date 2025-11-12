import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

type User = { id: string; email: string; name?: string; avatar?: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
    private http = inject(HttpClient);

    private _user = signal<User | null>(null);
    private _access = signal<string | null>(localStorage.getItem('accessToken'));
    private _bootstrapped = signal(false);

    user = computed(() => this._user());
    isAuthed = computed(() => !!this._access() && !!this._user());

    /** Call once in app bootstrap or AppComponent */
    async bootstrap() {
        if (!this._access()) { this._bootstrapped.set(true); return; }
        try {
            const me = await this.http.get<User>('/api/auth/me').toPromise();
            this._user.set(me ?? null);
            if (me?.id) localStorage.setItem('userId', me.id); // ✅ keep for UI helpers
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
        return this.http.post('/api/auth/register', payload, { withCredentials: true }).toPromise();
    }

    async login(payload: { email: string; password: string }) {
        const res = await this.http.post<{
            accessToken: string; refreshToken?: string; user: User;
        }>('/api/auth/login', payload, { withCredentials: true }).toPromise();

        if (res?.accessToken) {
            this._access.set(res.accessToken);
            localStorage.setItem('accessToken', res.accessToken);
        }
        this._user.set(res?.user ?? null);
        return res;
    }

    async logout() {
        try { await this.http.post('/api/auth/logout', {}, { withCredentials: true }).toPromise(); } catch {}
        this._user.set(null);
        this._access.set(null);
        localStorage.removeItem('accessToken');
    }

    /** Automatically called by interceptor on 401 */
    // ⬇️ add withCredentials: true on refresh
    async tryRefresh(): Promise<boolean> {
        try {
            const res = await this.http
                .post<{ accessToken: string }>(
                    '/api/auth/refresh',
                    {},
                    { withCredentials: true }   // ✅ important
                )
                .toPromise();

            if (res?.accessToken) {
                this._access.set(res.accessToken);
                localStorage.setItem('accessToken', res.accessToken);

                const me = await this.http.get<User>('/api/auth/me').toPromise();
                this._user.set(me || null);

                // ⬇️ persist userId because your CardsService uses it in withUser()
                if (me?.id) localStorage.setItem('userId', me.id);

                return true;
            }
        } catch {}
        this._user.set(null);
        this._access.set(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userId');
        return false;
    }

    // Password reset flows
    requestPassword(email: string) {
        return this.http.post<{ ok: boolean; resetToken?: string }>(
            '/api/auth/password/request', { email }, { withCredentials: true }
        ).toPromise();
    }

    resetPassword(token: string, password: string) {
        return this.http.post('/api/auth/password/reset', { token, password }, { withCredentials: true }).toPromise();
    }

    get accessToken() { return this._access(); }
    get bootstrapped() { return this._bootstrapped(); }
}
