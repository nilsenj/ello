import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule, XIcon, UserPlusIcon, Trash2Icon } from 'lucide-angular';
import { WorkspaceMembersModalService } from './workspace-members-modal.service';
import { WorkspacesService, WorkspaceMember } from '../../data/workspaces.service';
import { AuthService } from '../../auth/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
    standalone: true,
    selector: 'workspace-members-modal',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './workspace-members-modal.component.html',
})
export class WorkspaceMembersModalComponent {
    readonly XIcon = XIcon;
    readonly UserPlusIcon = UserPlusIcon;
    readonly Trash2Icon = Trash2Icon;
    readonly tTitle = $localize`:@@workspaceMembers.title:Workspace Members`;
    readonly tInvitePlaceholder = $localize`:@@workspaceMembers.invitePlaceholder:Enter email address to invite...`;
    readonly tInvite = $localize`:@@workspaceMembers.invite:Invite`;
    readonly tInviting = $localize`:@@workspaceMembers.inviting:Inviting...`;
    readonly tLoading = $localize`:@@workspaceMembers.loading:Loading members...`;
    readonly tPending = $localize`:@@workspaceMembers.pending:Pending`;
    readonly tRemoveTitle = $localize`:@@workspaceMembers.removeTitle:Remove member`;
    readonly tInviteSent = $localize`:@@workspaceMembers.toastInviteSent:Invitation sent successfully`;
    readonly tMemberAdded = $localize`:@@workspaceMembers.toastMemberAdded:Member added successfully`;
    readonly tInviteFailed = $localize`:@@workspaceMembers.toastInviteFailed:Failed to invite member`;
    readonly tMemberRemoved = $localize`:@@workspaceMembers.toastMemberRemoved:Member removed successfully`;
    readonly tRemoveFailed = $localize`:@@workspaceMembers.toastRemoveFailed:Failed to remove member`;
    readonly tRoleOwner = $localize`:@@workspaceMembers.role.owner:Owner`;
    readonly tRoleAdmin = $localize`:@@workspaceMembers.role.admin:Admin`;
    readonly tRoleMember = $localize`:@@workspaceMembers.role.member:Member`;
    readonly tRoleViewer = $localize`:@@workspaceMembers.role.viewer:Viewer`;

    modal = inject(WorkspaceMembersModalService);
    workspacesApi = inject(WorkspacesService);
    http = inject(HttpClient);
    auth = inject(AuthService);

    members = signal<WorkspaceMember[]>([]);
    loading = signal(false);
    inviteEmail = signal('');
    inviting = signal(false);

    isValidEmail = computed(() => {
        const email = this.inviteEmail().trim();
        // Basic email regex
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    });

    inviteRole = signal<'owner' | 'admin' | 'member' | 'viewer'>('member');
    availableRoles = computed(() => {
        const ws = this.modal.workspace();
        if (ws?.role === 'owner') {
            return ['owner', 'admin', 'member', 'viewer'] as const;
        }
        // Admins can assign any role up to Admin
        return ['admin', 'member', 'viewer'] as const;
    });

    // Valid roles to display in UI
    roleLabels: Record<string, string> = {
        owner: this.tRoleOwner,
        admin: this.tRoleAdmin,
        member: this.tRoleMember,
        viewer: this.tRoleViewer
    };

    // UI State
    toastMessage = signal<string | null>(null);
    toastType = signal<'success' | 'error'>('success');

    constructor() {
        effect(() => {
            const ws = this.modal.workspace();
            if (ws) {
                this.loadMembers(ws.id);
            } else {
                this.members.set([]);
            }
        }, { allowSignalWrites: true });
    }

    canInvite = computed(() => {
        const ws = this.modal.workspace();
        if (!ws) return false;
        // Strict restriction: Only Owners and Admins can invite
        return ws.role === 'owner' || ws.role === 'admin';
    });

    canRemove = computed(() => {
        const ws = this.modal.workspace();
        if (!ws) return false;
        return ws.role === 'owner' || ws.role === 'admin';
    });

    canRemoveMember(member: WorkspaceMember): boolean {
        const ws = this.modal.workspace();
        const currentUser = this.auth.user();
        if (!ws || !currentUser) return false;

        // Must be admin or owner to remove
        if (ws.role !== 'owner' && ws.role !== 'admin') return false;

        // Owners cannot remove themselves
        if (member.role === 'owner' && member.id === currentUser.id) return false;

        // Admins cannot remove Owners
        if (ws.role === 'admin' && member.role === 'owner') return false;

        return true;
    }

    async loadMembers(workspaceId: string) {
        this.loading.set(true);
        try {
            const res = await firstValueFrom(this.http.get<{ members: WorkspaceMember[] }>(`/api/workspaces/${workspaceId}/members`));
            this.members.set(res.members);
        } catch (err) {
            console.error('Failed to load members', err);
        } finally {
            this.loading.set(false);
        }
    }

    close() {
        this.modal.close();
        this.inviteEmail.set('');
        this.inviteRole.set('member');
        this.toastMessage.set(null);
    }

    onBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            this.close();
        }
    }

    async invite() {
        const ws = this.modal.workspace();
        if (!ws || !this.isValidEmail() || this.inviting()) return;

        this.inviting.set(true);
        this.toastMessage.set(null);

        try {
            const res = await this.workspacesApi.addMember(ws.id, this.inviteEmail(), this.inviteRole());
            this.inviteEmail.set('');
            this.inviteRole.set('member'); // reset to default
            await this.loadMembers(ws.id); // Reload list

            if (res.status === 'pending') {
                this.showToast(this.tInviteSent, 'success');
            } else {
                this.showToast(this.tMemberAdded, 'success');
            }
        } catch (err: any) {
            console.error('Failed to invite member', err);
            this.showToast(err.error?.error || this.tInviteFailed, 'error');
        } finally {
            this.inviting.set(false);
        }
    }

    async remove(member: WorkspaceMember) {
        const ws = this.modal.workspace();
        if (!ws) return;

        const label = member.name || member.email || '';
        const confirmMessage = $localize`:@@workspaceMembers.removeConfirm:Are you sure you want to remove ${label}?`;
        if (!confirm(confirmMessage)) return;

        try {
            await this.workspacesApi.removeMember(ws.id, member.id);
            this.showToast(this.tMemberRemoved, 'success');
            await this.loadMembers(ws.id);
        } catch (err: any) {
            console.error('Failed to remove member', err);
            this.showToast(err.error?.error || this.tRemoveFailed, 'error');
        }
    }

    getMembersTitle(): string {
        const count = this.members().length;
        return $localize`:@@workspaceMembers.membersTitle:Members (${count})`;
    }

    showToast(message: string, type: 'success' | 'error') {
        this.toastMessage.set(message);
        this.toastType.set(type);
        setTimeout(() => this.toastMessage.set(null), 3000);
    }
}
