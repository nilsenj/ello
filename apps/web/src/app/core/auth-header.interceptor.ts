import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AuthHeaderInterceptor implements HttpInterceptor {
    private auth = inject(AuthService);

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const isApi = req.url.startsWith('/api');
        const isAuthEndpoint = isApi && req.url.startsWith('/api/auth');

        // Always send cookies on /api/auth/* (refresh/login/register/logout)
        if (isAuthEndpoint) {
            req = req.clone({ withCredentials: true });
            return next.handle(req);
        }

        // For other /api/* calls — attach Bearer if we have it
        const token = this.auth.accessToken;
        if (isApi && token) {
            req = req.clone({
                setHeaders: { Authorization: `Bearer ${token}` },
                withCredentials: true // harmless + useful if you later add cookie-based features
            });
        }

        return next.handle(req);
    }
}
