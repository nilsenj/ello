// apps/web/src/app/components/workspace-settings-advanced-modal/workspace-settings-advanced-modal.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WorkspaceSettingsAdvancedModalService {
    isOpen = signal(false);
    workspaceId = signal<string | null>(null);

    open(workspaceId: string) {
        this.workspaceId.set(workspaceId);
        this.isOpen.set(true);
    }

    close() {
        this.isOpen.set(false);
        this.workspaceId.set(null);
    }
}
