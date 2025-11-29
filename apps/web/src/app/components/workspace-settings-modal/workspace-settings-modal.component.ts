import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, XIcon, Trash2Icon } from 'lucide-angular';
import { WorkspaceSettingsModalService } from './workspace-settings-modal.service';
import { WorkspaceSettingsAdvancedModalService } from '../workspace-settings-advanced-modal/workspace-settings-advanced-modal.service';
import { WorkspacesService } from '../../data/workspaces.service';

@Component({
    standalone: true,
    selector: 'workspace-settings-modal',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './workspace-settings-modal.component.html',
})
export class WorkspaceSettingsModalComponent {
    readonly XIcon = XIcon;
    readonly Trash2Icon = Trash2Icon;

    modal = inject(WorkspaceSettingsModalService);
    advancedModal = inject(WorkspaceSettingsAdvancedModalService);
    workspacesApi = inject(WorkspacesService);

    name = signal('');
    description = signal('');
    saving = signal(false);
    deleting = signal(false);

    constructor() {
        effect(() => {
            const ws = this.modal.workspace();
            if (ws) {
                this.name.set(ws.name);
                this.description.set(ws.description || '');
            }
        }, { allowSignalWrites: true });
    }

    close() {
        this.modal.close();
    }

    onBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            this.close();
        }
    }

    async save() {
        const ws = this.modal.workspace();
        if (!ws || !this.name().trim() || this.saving()) return;

        this.saving.set(true);
        try {
            await this.workspacesApi.update(ws.id, {
                name: this.name(),
                description: this.description()
            });
            window.location.reload(); // Reload to refresh data
            this.close();
        } catch (err) {
            console.error('Failed to update workspace', err);
        } finally {
            this.saving.set(false);
        }
    }

    async deleteWorkspace() {
        const ws = this.modal.workspace();
        if (!ws || this.deleting()) return;

        if (!confirm(`Are you sure you want to delete workspace "${ws.name}"? This cannot be undone.`)) return;

        this.deleting.set(true);
        try {
            await this.workspacesApi.delete(ws.id);
            window.location.reload(); // Reload to refresh data
            this.close();
        } catch (err) {
            console.error('Failed to delete workspace', err);
            alert('Failed to delete workspace. Ensure you are the owner.');
        } finally {
            this.deleting.set(false);
        }
    }

    openAdvancedSettings() {
        const ws = this.modal.workspace();
        if (!ws) return;
        this.advancedModal.open(ws.id);
    }
}
