import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BoardCreateModalService {
    readonly isOpen = signal(false);
    readonly workspaceId = signal<string | null>(null);

    open(workspaceId?: string) {
        this.workspaceId.set(workspaceId || null);
        this.isOpen.set(true);
    }

    close() {
        this.isOpen.set(false);
        this.workspaceId.set(null);
    }
}
