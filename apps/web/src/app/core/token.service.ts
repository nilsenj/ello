// apps/web/src/app/core/token.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenService {
    access = signal<string | null>(null);
    refresh = signal<string | null>(null);
    setTokens(a: string, r: string) { this.access.set(a); this.refresh.set(r); }
    clear() { this.access.set(null); this.refresh.set(null); }
}
