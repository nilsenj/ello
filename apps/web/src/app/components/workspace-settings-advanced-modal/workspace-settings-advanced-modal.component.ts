import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkspaceSettingsAdvancedModalService } from './workspace-settings-advanced-modal.service';
import { WorkspacesService, type WorkspaceSettings, type WorkspaceSettingsUpdate } from '../../data/workspaces.service';

@Component({
    standalone: true,
    selector: 'workspace-settings-advanced-modal',
    imports: [CommonModule, FormsModule],
    template: `
        <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" *ngIf="modalService.isOpen()" (click)="onOverlayClick($event)">
            <div class="bg-white rounded-xl w-[min(92vw,600px)] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col" (click)="$event.stopPropagation()">
                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-gray-800 m-0">
                        {{ tTitle }}
                    </h2>
                    <button class="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center w-8 h-8" (click)="close()" type="button">×</button>
                </div>

                <div class="p-5 flex-1 overflow-y-auto overflow-x-hidden">
                    <div *ngIf="error()" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
                        {{ error() }}
                    </div>

                    <div *ngIf="success()" class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm mb-4">
                        {{ tSaved }}
                    </div>

                    <div *ngIf="loading()" class="text-center py-10">
                        <div class="text-gray-500">{{ tLoading }}</div>
                    </div>

                    <form *ngIf="!loading() && settings()" (ngSubmit)="onSave()" class="space-y-6">
                        <!-- Workspace Visibility -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">{{ tVisibilityLabel }}</label>
                            <div class="flex gap-4">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="visibility" 
                                        value="private"
                                        [(ngModel)]="formData.visibility"
                                        class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <span class="text-sm text-gray-700">{{ tPrivate }}</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="visibility" 
                                        value="public"
                                        [(ngModel)]="formData.visibility"
                                        class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                    />
                                    <span class="text-sm text-gray-700">{{ tPublic }}</span>
                                </label>
                            </div>
                            <div class="mt-1.5 text-xs text-gray-500">
                                {{ tVisibilityHelp }}
                            </div>
                        </div>

                        <!-- Who Can Create Boards -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5" for="createBoards">{{ tCreateBoardsLabel }}</label>
                            <select 
                                id="createBoards"
                                [(ngModel)]="formData.whoCanCreateBoards"
                                name="whoCanCreateBoards"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            >
                                <option value="admins">{{ tAdminsOnly }}</option>
                                <option value="members">{{ tAllMembers }}</option>
                            </select>
                            <div class="mt-1.5 text-xs text-gray-500">
                                {{ tCreateBoardsHelp }}
                            </div>
                        </div>

                        <!-- Who Can Invite Members -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5" for="inviteMembers">{{ tInviteMembersLabel }}</label>
                            <select 
                                id="inviteMembers"
                                [(ngModel)]="formData.whoCanInviteMembers"
                                name="whoCanInviteMembers"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            >
                                <option value="admins">{{ tAdminsOnly }}</option>
                                <option value="members">{{ tAllMembers }}</option>
                            </select>
                            <div class="mt-1.5 text-xs text-gray-500">
                                {{ tInviteMembersHelp }}
                            </div>
                        </div>

                        <!-- Email Domain Restrictions -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5" for="emailDomains">{{ tEmailDomainsLabel }}</label>
                            <input 
                                type="text"
                                id="emailDomains"
                                [(ngModel)]="formData.allowedEmailDomains"
                                name="allowedEmailDomains"
                                [placeholder]="tEmailDomainsPlaceholder"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            />
                            <div class="mt-1.5 text-xs text-gray-500">
                                {{ tEmailDomainsHelp }}
                            </div>
                        </div>

                        <!-- Default Board Visibility -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1.5" for="defaultVisibility">{{ tDefaultBoardVisibilityLabel }}</label>
                            <select 
                                id="defaultVisibility"
                                [(ngModel)]="formData.defaultBoardVisibility"
                                name="defaultBoardVisibility"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            >
                                <option value="private">{{ tDefaultBoardVisibilityPrivate }}</option>
                                <option value="workspace">{{ tDefaultBoardVisibilityWorkspace }}</option>
                                <option value="public">{{ tDefaultBoardVisibilityPublic }}</option>
                            </select>
                            <div class="mt-1.5 text-xs text-gray-500">
                                {{ tDefaultBoardVisibilityHelp }}
                            </div>
                        </div>
                    </form>
                </div>

                <div class="px-5 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl flex justify-end gap-3">
                    <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors" (click)="close()">
                        {{ tCancel }}
                    </button>
                    <button 
                        type="button" 
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                        (click)="onSave()"
                        [disabled]="saving() || loading()"
                    >
                        {{ saving() ? tSaving : tSave }}
                    </button>
                </div>
            </div>
        </div>
    `
})
export class WorkspaceSettingsAdvancedModalComponent {
    modalService = inject(WorkspaceSettingsAdvancedModalService);
    workspacesService = inject(WorkspacesService);
    readonly tTitle = $localize`:@@workspaceSettingsAdvanced.title:Workspace Settings`;
    readonly tSaved = $localize`:@@workspaceSettingsAdvanced.saved:Settings saved successfully!`;
    readonly tLoading = $localize`:@@workspaceSettingsAdvanced.loading:Loading settings...`;
    readonly tVisibilityLabel = $localize`:@@workspaceSettingsAdvanced.visibilityLabel:Workspace Visibility`;
    readonly tPrivate = $localize`:@@workspaceSettingsAdvanced.private:Private`;
    readonly tPublic = $localize`:@@workspaceSettingsAdvanced.public:Public`;
    readonly tVisibilityHelp = $localize`:@@workspaceSettingsAdvanced.visibilityHelp:Private workspaces are only visible to members. Public workspaces are viewable by anyone (but only editable by members).`;
    readonly tCreateBoardsLabel = $localize`:@@workspaceSettingsAdvanced.createBoardsLabel:Who can create boards?`;
    readonly tInviteMembersLabel = $localize`:@@workspaceSettingsAdvanced.inviteMembersLabel:Who can invite members?`;
    readonly tAdminsOnly = $localize`:@@workspaceSettingsAdvanced.adminsOnly:Admins only`;
    readonly tAllMembers = $localize`:@@workspaceSettingsAdvanced.allMembers:All members`;
    readonly tCreateBoardsHelp = $localize`:@@workspaceSettingsAdvanced.createBoardsHelp:Controls who can create new boards in this workspace.`;
    readonly tInviteMembersHelp = $localize`:@@workspaceSettingsAdvanced.inviteMembersHelp:Controls who can invite new members to this workspace.`;
    readonly tEmailDomainsLabel = $localize`:@@workspaceSettingsAdvanced.emailDomainsLabel:Allowed email domains (optional)`;
    readonly tEmailDomainsPlaceholder = $localize`:@@workspaceSettingsAdvanced.emailDomainsPlaceholder:e.g., company.com, partner.com`;
    readonly tEmailDomainsHelp = $localize`:@@workspaceSettingsAdvanced.emailDomainsHelp:Only users with these email domains can be invited. Leave empty for no restrictions. Separate multiple domains with commas.`;
    readonly tDefaultBoardVisibilityLabel = $localize`:@@workspaceSettingsAdvanced.defaultBoardVisibilityLabel:Default board visibility`;
    readonly tDefaultBoardVisibilityPrivate = $localize`:@@workspaceSettingsAdvanced.defaultBoardVisibilityPrivate:Private`;
    readonly tDefaultBoardVisibilityWorkspace = $localize`:@@workspaceSettingsAdvanced.defaultBoardVisibilityWorkspace:Workspace visible`;
    readonly tDefaultBoardVisibilityPublic = $localize`:@@workspaceSettingsAdvanced.defaultBoardVisibilityPublic:Public`;
    readonly tDefaultBoardVisibilityHelp = $localize`:@@workspaceSettingsAdvanced.defaultBoardVisibilityHelp:Default visibility setting for newly created boards.`;
    readonly tCancel = $localize`:@@workspaceSettingsAdvanced.cancel:Cancel`;
    readonly tSave = $localize`:@@workspaceSettingsAdvanced.save:Save Settings`;
    readonly tSaving = $localize`:@@workspaceSettingsAdvanced.saving:Saving...`;
    readonly tLoadFailed = $localize`:@@workspaceSettingsAdvanced.loadFailed:Failed to load settings`;
    readonly tSaveFailed = $localize`:@@workspaceSettingsAdvanced.saveFailed:Failed to save settings`;

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
            this.error.set(err?.error?.error || this.tLoadFailed);
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
            this.error.set(err?.error?.error || this.tSaveFailed);
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
