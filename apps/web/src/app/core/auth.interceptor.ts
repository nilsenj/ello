import { Injectable, inject } from '@angular/core';
import {
    HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import {AuthService} from "../auth/auth.service";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    private auth = inject(AuthService);

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const isRefreshEndpoint = req.url.includes('/api/auth/refresh');
        const token = this.auth.accessToken;
        const authedReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

        return next.handle(authedReq).pipe(
            catchError((err: unknown) => {
                if (err instanceof HttpErrorResponse && err.status === 401 && !isRefreshEndpoint) {
                    // attempt refresh once
                    return from(this.auth.tryRefresh()).pipe(
                        switchMap(ok => {
                            if (!ok) return throwError(() => err);
                            const retryToken = this.auth.accessToken;
                            const retried = retryToken
                                ? req.clone({ setHeaders: { Authorization: `Bearer ${retryToken}` } })
                                : req;
                            return next.handle(retried);
                        })
                    );
                }
                return throwError(() => err);
            })
        );
    }
}
