import { Injectable, signal } from '@angular/core';
import { WorkspaceLite } from '../../data/workspaces.service';

@Injectable({
    providedIn: 'root'
})
export class WorkspaceMembersModalService {
    isOpen = signal(false);
    workspace = signal<WorkspaceLite | null>(null);

    open(workspace: WorkspaceLite) {
        this.workspace.set(workspace);
        this.isOpen.set(true);
    }

    close() {
        this.isOpen.set(false);
        this.workspace.set(null);
    }
}
