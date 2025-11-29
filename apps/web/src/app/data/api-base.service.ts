import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

type RequestOptions = {
    headers?: HttpHeaders;
};

@Injectable({ providedIn: 'root' })
export class ApiBaseService {
    private http = inject(HttpClient);

    get<T>(url: string, options: RequestOptions = {}) {
        return firstValueFrom(
            this.http.get<T>(url, {
                withCredentials: true,
                ...options,
            }),
        );
    }

    post<T>(url: string, body: unknown, options: RequestOptions = {}) {
        return firstValueFrom(
            this.http.post<T>(url, body, {
                withCredentials: true,
                ...options,
            }),
        );
    }

    patch<T>(url: string, body: unknown, options: RequestOptions = {}) {
        return firstValueFrom(
            this.http.patch<T>(url, body, {
                withCredentials: true,
                ...options,
            }),
        );
    }

    delete<T = unknown>(url: string, options: RequestOptions = {}) {
        return firstValueFrom(
            this.http.delete<T>(url, {
                withCredentials: true,
                ...options,
            }),
        );
    }
}
