import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';

type RequestOptions = {
    headers?: HttpHeaders;
};

@Injectable({ providedIn: 'root' })
export class ApiBaseService {
    private http = inject(HttpClient);

    private getUrl(path: string): string {
        return `${environment.apiOrigin}${path}`;
    }

    get<T>(path: string, options: RequestOptions = {}) {
        return firstValueFrom(
            this.http.get<T>(this.getUrl(path), {
                withCredentials: true,
                ...options,
            }),
        );
    }

    post<T>(path: string, body: unknown, options: RequestOptions = {}) {
        return firstValueFrom(
            this.http.post<T>(this.getUrl(path), body, {
                withCredentials: true,
                ...options,
            }),
        );
    }

    put<T>(path: string, body: unknown, options: RequestOptions = {}) {
        return firstValueFrom(
            this.http.put<T>(this.getUrl(path), body, {
                withCredentials: true,
                ...options,
            }),
        );
    }

    patch<T>(path: string, body: unknown, options: RequestOptions = {}) {
        return firstValueFrom(
            this.http.patch<T>(this.getUrl(path), body, {
                withCredentials: true,
                ...options,
            }),
        );
    }

    delete<T = unknown>(path: string, options: RequestOptions = {}) {
        return firstValueFrom(
            this.http.delete<T>(this.getUrl(path), {
                withCredentials: true,
                ...options,
            }),
        );
    }
}
