import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkspaceSettingsAdvancedModalService } from './workspace-settings-advanced-modal.service';
import { WorkspacesService, type WorkspaceSettings, type WorkspaceSettingsUpdate } from '../../data/workspaces.service';

@Component({
    standalone: true,
    selector: 'workspace-settings-advanced-modal',
    imports: [CommonModule, FormsModule],
    styles: [`
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }

        .modal {
            background: white;
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .modal-body {
            padding: 24px;
        }

        .modal-footer {
            padding: 16px 24px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }

        .form-group {
            margin-bottom: 24px;
        }

        .form-label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
        }

        .form-help {
            font-size: 13px;
            color: #6b7280;
            margin-top: 4px;
        }

        .radio-group {
            display: flex;
            gap: 16px;
            margin-top: 8px;
        }

        .radio-option {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
        }

        .radio-option input[type="radio"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }

        select, input[type="text"] {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.2s;
        }

        select:focus, input[type="text"]:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .btn {
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
        }

        .btn-primary {
            background: #3b82f6;
            color: white;
        }

        .btn-primary:hover:not(:disabled) {
            background: #2563eb;
        }

        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-secondary {
            background: #f3f4f6;
            color: #374151;
        }

        .btn-secondary:hover {
            background: #e5e7eb;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            color: #9ca3af;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
        }

        .close-btn:hover {
            background: #f3f4f6;
            color: #374151;
        }

        .error-message {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #991b1b;
            padding: 12px;
            border-radius: 6px;
            font-size: 14px;
            margin-bottom: 16px;
        }

        .success-message {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
            padding: 12px;
            border-radius: 6px;
            font-size: 14px;
            margin-bottom: 16px;
        }
    `],
    template: `
        <div class="modal-overlay" *ngIf="modalService.isOpen()" (click)="onOverlayClick($event)">
            <div class="modal" (click)="$event.stopPropagation()">
                <div class="modal-header">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #111827;">
                        Workspace Settings
                    </h2>
                    <button class="close-btn" (click)="close()" type="button">×</button>
                </div>

                <div class="modal-body">
                    <div *ngIf="error()" class="error-message">
                        {{ error() }}
                    </div>

                    <div *ngIf="success()" class="success-message">
                        Settings saved successfully!
                    </div>

                    <div *ngIf="loading()" style="text-align: center; padding: 40px;">
                        <div style="color: #6b7280;">Loading settings...</div>
                    </div>

                    <form *ngIf="!loading() && settings()" (ngSubmit)="onSave()">
                        <!-- Workspace Visibility -->
                        <div class="form-group">
                            <label class="form-label">Workspace Visibility</label>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input 
                                        type="radio" 
                                        name="visibility" 
                                        value="private"
                                        [(ngModel)]="formData.visibility"
                                    />
                                    <span>Private</span>
                                </label>
                                <label class="radio-option">
                                    <input 
                                        type="radio" 
                                        name="visibility" 
                                        value="public"
                                        [(ngModel)]="formData.visibility"
                                    />
                                    <span>Public</span>
                                </label>
                            </div>
                            <div class="form-help">
                                Private workspaces are only visible to members. Public workspaces are viewable by anyone (but only editable by members).
                            </div>
                        </div>

                        <!-- Who Can Create Boards -->
                        <div class="form-group">
                            <label class="form-label" for="createBoards">Who can create boards?</label>
                            <select 
                                id="createBoards"
                                [(ngModel)]="formData.whoCanCreateBoards"
                                name="whoCanCreateBoards"
                            >
                                <option value="admins">Admins only</option>
                                <option value="members">All members</option>
                            </select>
                            <div class="form-help">
                                Controls who can create new boards in this workspace.
                            </div>
                        </div>

                        <!-- Who Can Invite Members -->
                        <div class="form-group">
                            <label class="form-label" for="inviteMembers">Who can invite members?</label>
                            <select 
                                id="inviteMembers"
                                [(ngModel)]="formData.whoCanInviteMembers"
                                name="whoCanInviteMembers"
                            >
                                <option value="admins">Admins only</option>
                                <option value="members">All members</option>
                            </select>
                            <div class="form-help">
                                Controls who can invite new members to this workspace.
                            </div>
                        </div>

                        <!-- Email Domain Restrictions -->
                        <div class="form-group">
                            <label class="form-label" for="emailDomains">Allowed email domains (optional)</label>
                            <input 
                                type="text"
                                id="emailDomains"
                                [(ngModel)]="formData.allowedEmailDomains"
                                name="allowedEmailDomains"
                                placeholder="e.g., company.com, partner.com"
                            />
                            <div class="form-help">
                                Only users with these email domains can be invited. Leave empty for no restrictions. Separate multiple domains with commas.
                            </div>
                        </div>

                        <!-- Default Board Visibility -->
                        <div class="form-group">
                            <label class="form-label" for="defaultVisibility">Default board visibility</label>
                            <select 
                                id="defaultVisibility"
                                [(ngModel)]="formData.defaultBoardVisibility"
                                name="defaultBoardVisibility"
                            >
                                <option value="private">Private</option>
                                <option value="workspace">Workspace visible</option>
                                <option value="public">Public</option>
                            </select>
                            <div class="form-help">
                                Default visibility setting for newly created boards.
                            </div>
                        </div>
                    </form>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" (click)="close()">
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        class="btn btn-primary" 
                        (click)="onSave()"
                        [disabled]="saving() || loading()"
                    >
                        {{ saving() ? 'Saving...' : 'Save Settings' }}
                    </button>
                </div>
            </div>
        </div>
    `
})
export class WorkspaceSettingsAdvancedModalComponent {
    modalService = inject(WorkspaceSettingsAdvancedModalService);
    workspacesService = inject(WorkspacesService);

    settings = signal<WorkspaceSettings | null>(null);
    loading = signal(false);
    saving = signal(false);
    error = signal<string | null>(null);
    success = signal(false);

    formData: WorkspaceSettingsUpdate = {
        visibility: 'private',
        whoCanCreateBoards: 'members',
        whoCanInviteMembers: 'members',
        allowedEmailDomains: '',
        defaultBoardVisibility: 'workspace',
    };

    constructor() {
        // Load settings when modal opens
        effect(() => {
            if (this.modalService.isOpen()) {
                this.loadSettings();
            } else {
                this.reset();
            }
        }, { allowSignalWrites: true });
    }

    async loadSettings() {
        const workspaceId = this.modalService.workspaceId();
        if (!workspaceId) return;

        this.loading.set(true);
        this.error.set(null);

        try {
            const settings = await this.workspacesService.getSettings(workspaceId);
            this.settings.set(settings);

            // Populate form
            this.formData = {
                visibility: settings.visibility,
                whoCanCreateBoards: settings.whoCanCreateBoards,
                whoCanInviteMembers: settings.whoCanInviteMembers,
                allowedEmailDomains: settings.allowedEmailDomains || '',
                defaultBoardVisibility: settings.defaultBoardVisibility,
            };
        } catch (err: any) {
            this.error.set(err?.error?.error || 'Failed to load settings');
        } finally {
            this.loading.set(false);
        }
    }

    async onSave() {
        const workspaceId = this.modalService.workspaceId();
        if (!workspaceId) return;

        this.saving.set(true);
        this.error.set(null);
        this.success.set(false);

        try {
            const updates: WorkspaceSettingsUpdate = {
                visibility: this.formData.visibility,
                whoCanCreateBoards: this.formData.whoCanCreateBoards,
                whoCanInviteMembers: this.formData.whoCanInviteMembers,
                allowedEmailDomains: this.formData.allowedEmailDomains?.trim() || null,
                defaultBoardVisibility: this.formData.defaultBoardVisibility,
            };

            const updated = await this.workspacesService.updateSettings(workspaceId, updates);
            this.settings.set(updated);
            this.success.set(true);

            // Auto-close after 1.5 seconds
            setTimeout(() => {
                this.close();
            }, 1500);
        } catch (err: any) {
            this.error.set(err?.error?.error || 'Failed to save settings');
        } finally {
            this.saving.set(false);
        }
    }

    close() {
        this.modalService.close();
    }

    onOverlayClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            this.close();
        }
    }

    reset() {
        this.settings.set(null);
        this.error.set(null);
        this.success.set(false);
        this.saving.set(false);
        this.loading.set(false);
    }
}
