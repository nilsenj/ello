import { Injectable, signal } from '@angular/core';

export type UserSettingsTab = 'profile' | 'security' | 'plan';

@Injectable({ providedIn: 'root' })
export class UserSettingsModalService {
    isOpen = signal(false);
    initialTab = signal<UserSettingsTab | null>(null);
    initialWorkspaceId = signal<string | null>(null);

    open(initialTab?: UserSettingsTab, workspaceId?: string) {
        this.initialTab.set(initialTab ?? null);
        this.initialWorkspaceId.set(workspaceId ?? null);
        this.isOpen.set(true);
    }

    close() {
        this.isOpen.set(false);
        this.initialTab.set(null);
        this.initialWorkspaceId.set(null);
    }
}
