// apps/web/src/app/ui/card-modal/card-modal.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class CardModalService {
    private router = inject(Router);
    private route  = inject(ActivatedRoute);

    private _isOpen = signal(false);
    private _cardId = signal<string>('');
    private ignoreNext = false;

    isOpen = this._isOpen.asReadonly();
    cardId = this._cardId.asReadonly();

    constructor() {
        this.router.events
            .pipe(filter(e => e instanceof NavigationEnd))
            .subscribe(() => {
                if (this.ignoreNext) { this.ignoreNext = false; return; }
                const id = this.readCardFromHash();
                if (id) {
                    this._cardId.set(id);
                    this._isOpen.set(true);
                } else {
                    this._isOpen.set(false);
                    this._cardId.set('');
                }
            });

        const idNow = this.readCardFromHash();
        if (idNow) {
            this._cardId.set(idNow);
            this._isOpen.set(true);
        }
    }

    open(id: string) {
        this._cardId.set(id);
        this._isOpen.set(true);
        this.ignoreNext = true;
        this.setHashParam('card', id);
    }

    close() {
        this._isOpen.set(false);
        this._cardId.set('');
        this.ignoreNext = true;
        this.removeHashParam('card');
    }

    // --- Hash helpers ---
    private get hashParams(): URLSearchParams {
        const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '');
        return new URLSearchParams(raw);
    }

    private readCardFromHash(): string | null {
        const params = this.hashParams;
        const id = params.get('card');
        return id && id.trim() ? id : null;
    }

    private setHashParam(key: string, value: string) {
        const params = this.hashParams;
        params.set(key, value);
        this.router.navigate([], {
            relativeTo: this.route,
            fragment: params.toString(),  // e.g. 'card=abc123'
            replaceUrl: true,
        });
    }

    private removeHashParam(key: string) {
        const params = this.hashParams;
        params.delete(key);
        const nextFrag = params.toString() || null;
        this.router.navigate([], {
            relativeTo: this.route,
            fragment: nextFrag as string,  // null removes hash
            replaceUrl: true,
        });
    }
}
