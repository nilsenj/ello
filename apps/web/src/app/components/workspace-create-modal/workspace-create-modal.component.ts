import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, XIcon } from 'lucide-angular';
import { WorkspaceCreateModalService } from './workspace-create-modal.service';
import { WorkspacesService } from '../../data/workspaces.service';

@Component({
    standalone: true,
    selector: 'workspace-create-modal',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './workspace-create-modal.component.html',
})
export class WorkspaceCreateModalComponent {
    readonly XIcon = XIcon;

    modal = inject(WorkspaceCreateModalService);
    workspacesApi = inject(WorkspacesService);

    name = signal('');
    description = signal('');
    creating = signal(false);

    close() {
        this.modal.close();
        this.reset();
    }

    reset() {
        this.name.set('');
        this.description.set('');
        this.creating.set(false);
    }

    onBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            this.close();
        }
    }

    async create() {
        if (!this.name().trim() || this.creating()) return;

        this.creating.set(true);
        try {
            await this.workspacesApi.create({
                name: this.name(),
                description: this.description()
            });
            // Refresh list (assuming parent component reloads or we add to store)
            // For now, we might need to trigger a reload or return the created workspace
            // But since HomePage reloads on init, we might need a way to notify it.
            // A simple way is to reload the page or use a shared store.
            // For now, let's just close. Ideally, HomePage should subscribe to a store.
            window.location.reload(); // Simple brute force for now to ensure state sync
            this.close();
        } catch (err) {
            console.error('Failed to create workspace', err);
        } finally {
            this.creating.set(false);
        }
    }
}
