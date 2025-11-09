// apps/web/src/app/core/auth-header.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthHeaderInterceptor implements HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const withHeaders = req.clone({
            setHeaders: {
                'x-user-id': 'demo-user',            // TODO: replace with real auth later
                'Content-Type': 'application/json'
            },
        });
        return next.handle(withHeaders);
    }
}
