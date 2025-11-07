import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiBaseService {
    private http = inject(HttpClient);

    get<T>(url: string) {
        return firstValueFrom(this.http.get<T>(url));
    }
    post<T>(url: string, body: unknown) {
        return firstValueFrom(this.http.post<T>(url, body));
    }
    patch<T>(url: string, body: unknown) {
        return firstValueFrom(this.http.patch<T>(url, body));
    }
    delete<T = unknown>(url: string) {
        return firstValueFrom(this.http.delete<T>(url));
    }
}
