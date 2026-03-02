// apps/web/src/app/ui/card-modal/card-modal.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export type PanelName =
    | 'labels'
    | 'members'
    | 'dates'
    | 'checklists'
    | 'attachments'
    | 'planning'
    | 'move'
    | 'copy'
    | 'delete';

@Injectable({ providedIn: 'root' })
export class CardModalService {
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    private _isOpen = signal(false);
    private _cardId = signal<string>('');
    private _initialPanel = signal<PanelName | null>(null);
    private ignoreNext = false;

    isOpen = this._isOpen.asReadonly();
    cardId = this._cardId.asReadonly();
    initialPanel = this._initialPanel.asReadonly();

    constructor() {
        this.router.events
            .pipe(filter(e => e instanceof NavigationEnd))
            .subscribe(() => {
                if (this.ignoreNext) {
                    this.ignoreNext = false;
                    return;
                }

                const id = this.readCardFromUrl();
                if (id) {
                    this._cardId.set(id);
                    this._isOpen.set(true);
                } else {
                    this._isOpen.set(false);
                    this._cardId.set('');
                }
            });

        const idNow = this.readCardFromUrl();
        if (idNow) {
            this._cardId.set(idNow);
            this._isOpen.set(true);
        }
    }

    open(id: string, panel: PanelName | null = null) {
        this._cardId.set(id);
        this._initialPanel.set(panel);
        this._isOpen.set(true);

        // Update URL for deep-linking without relying on fragment.
        this.ignoreNext = true;
        const currentUrl = this.router.parseUrl(this.router.url);
        currentUrl.queryParams['card'] = id;
        this.router.navigateByUrl(currentUrl, { replaceUrl: true });
    }

    close() {
        this._isOpen.set(false);
        this._cardId.set('');
        this._initialPanel.set(null);

        this.ignoreNext = true;
        const currentUrl = this.router.parseUrl(this.router.url);
        delete currentUrl.queryParams['card'];
        this.router.navigateByUrl(currentUrl, { replaceUrl: true });
    }

    private readCardFromUrl(): string | null {
        // Prefer query param `?card=`. Fallback to `#card=` if present.
        try {
            const url = this.router.parseUrl(this.router.url);
            const fromQuery = (url.queryParams?.['card'] ?? '').toString().trim();
            if (fromQuery) return fromQuery;

            const fromFragment = (url.fragment ?? '').toString();
            const fragParams = new URLSearchParams(fromFragment);
            const fromHash = (fragParams.get('card') ?? '').trim();
            return fromHash || null;
        } catch {
            return null;
        }
    }
}
