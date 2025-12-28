import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, X, User, Lock, Save, CreditCard } from 'lucide-angular';
import { UserSettingsModalService } from './user-settings-modal.service';
import { AuthService } from '../../auth/auth.service';
import { LOCALE_LABELS, SUPPORTED_LOCALES, getStoredLocale, setStoredLocale } from '../../i18n/i18n';
import { WorkspacesService, WorkspaceLite } from '../../data/workspaces.service';
import { BoardStore } from '../../store/board-store.service';

@Component({
    standalone: true,
    selector: 'user-settings-modal',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './user-settings-modal.component.html',
    styleUrls: ['./user-settings-modal.component.css'],
})
export class UserSettingsModalComponent {
    modal = inject(UserSettingsModalService);
    auth = inject(AuthService);
    workspacesApi = inject(WorkspacesService);
    store = inject(BoardStore);

    // Icons
    readonly XIcon = X;
    readonly UserIcon = User;
    readonly LockIcon = Lock;
    readonly PlanIcon = CreditCard;
    readonly SaveIcon = Save;

    // State
    activeTab = signal<'profile' | 'security' | 'plan'>('profile');
    supportedLocales = SUPPORTED_LOCALES;
    localeLabels = LOCALE_LABELS;
    locale = signal(getStoredLocale());
    savedLocale = signal(getStoredLocale());
    localeDirty = computed(() => this.locale() !== this.savedLocale());
    readonly tAccountSettings = $localize`:@@settings.account:Account Settings`;
    readonly tProfile = $localize`:@@settings.profile:Profile`;
    readonly tSecurity = $localize`:@@settings.security:Security`;
    readonly tPlanTab = $localize`:@@settings.planTab:Plan`;
    readonly tProfileDetails = $localize`:@@settings.profileDetails:Profile Details`;
    readonly tFullName = $localize`:@@settings.fullName:Full Name`;
    readonly tAvatarUrl = $localize`:@@settings.avatarUrl:Avatar URL`;
    readonly tAvatarHint = $localize`:@@settings.avatarHint:Enter a direct link to an image file.`;
    readonly tNamePlaceholder = $localize`:@@settings.namePlaceholder:Enter your name`;
    readonly tAvatarPlaceholder = $localize`:@@settings.avatarPlaceholder:https://example.com/avatar.jpg`;
    readonly tLanguage = $localize`:@@settings.language:Language`;
    readonly tApplyLanguage = $localize`:@@settings.applyLanguage:Apply language`;
    readonly tLanguageHint = $localize`:@@settings.languageHint:Changing language reloads the app.`;
    readonly tSaveChanges = $localize`:@@settings.saveChanges:Save Changes`;
    readonly tSaving = $localize`:@@settings.saving:Saving...`;
    readonly tChangePassword = $localize`:@@settings.changePassword:Change Password`;
    readonly tNewPassword = $localize`:@@settings.newPassword:New Password`;
    readonly tConfirmPassword = $localize`:@@settings.confirmPassword:Confirm Password`;
    readonly tPasswordPlaceholder = $localize`:@@settings.passwordPlaceholder:Enter new password`;
    readonly tConfirmPasswordPlaceholder = $localize`:@@settings.confirmPasswordPlaceholder:Confirm new password`;
    readonly tUpdatePassword = $localize`:@@settings.updatePassword:Update Password`;
    readonly tProfileUpdated = $localize`:@@settings.profileUpdated:Profile updated successfully`;
    readonly tFailedUpdateProfile = $localize`:@@settings.profileUpdateFailed:Failed to update profile`;
    readonly tPasswordsNoMatch = $localize`:@@settings.passwordMismatch:Passwords do not match`;
    readonly tPasswordTooShort = $localize`:@@settings.passwordTooShort:Password must be at least 6 characters`;
    readonly tPasswordUpdated = $localize`:@@settings.passwordUpdated:Password updated successfully`;
    readonly tFailedUpdatePassword = $localize`:@@settings.passwordUpdateFailed:Failed to update password`;
    readonly tLanguageReloading = $localize`:@@settings.languageReloading:Language updated. Reloading…`;
    readonly tPlanTitle = $localize`:@@settings.planTitle:Plan`;
    readonly tPlanWorkspace = $localize`:@@settings.planWorkspace:Workspace`;
    readonly tPlanCoreFree = $localize`:@@settings.planCoreFree:Core Free`;
    readonly tPlanCoreTeam = $localize`:@@settings.planCoreTeam:Core Team`;
    readonly tPlanCoreBusiness = $localize`:@@settings.planCoreBusiness:Core Business`;
    readonly tPlanBoards = $localize`:@@settings.planBoards:Boards`;
    readonly tPlanMembers = $localize`:@@settings.planMembers:Members`;
    readonly tPlanUnlimited = $localize`:@@settings.planUnlimited:Unlimited`;
    readonly tPlanCurrent = $localize`:@@settings.planCurrent:Current`;
    readonly tPlanComingSoon = $localize`:@@settings.planComingSoon:Coming soon`;
    readonly tPlanAvailable = $localize`:@@settings.planAvailable:Available upgrades`;
    readonly tPlanServiceDesk = $localize`:@@settings.planServiceDesk:Service Desk module`;
    readonly tPlanLimitReached = $localize`:@@settings.planLimitReached:You reached a core plan limit. Upgrade to add more.`;

    // Form Data
    name = signal('');
    avatar = signal('');
    password = signal('');
    confirmPassword = signal('');

    // UI State
    isSaving = signal(false);
    error = signal<string | null>(null);
    success = signal<string | null>(null);
    workspaces = signal<WorkspaceLite[]>([]);
    loadingPlan = signal(false);
    memberCounts = signal<Record<string, number | null>>({});
    initializedForOpen = signal(false);

    readonly corePlanLimits: Record<string, { maxBoards?: number; maxMembers?: number; label: string }> = {
        core_free: { maxBoards: 3, maxMembers: 5, label: this.tPlanCoreFree },
        core_team: { maxBoards: 10, maxMembers: 10, label: this.tPlanCoreTeam },
        core_business: { maxBoards: 50, maxMembers: 50, label: this.tPlanCoreBusiness },
    };
    readonly availablePlans = [
        { key: 'core_free', label: this.tPlanCoreFree, maxBoards: 3, maxMembers: 5 },
        { key: 'core_team', label: this.tPlanCoreTeam, maxBoards: 10, maxMembers: 10 },
        { key: 'core_business', label: this.tPlanCoreBusiness, maxBoards: 50, maxMembers: 50 },
    ];

    currentWorkspace = computed(() => {
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        const wsId = board?.workspaceId ?? this.workspaces()[0]?.id;
        if (!wsId) return null;
        return this.workspaces().find(w => w.id === wsId) ?? null;
    });

    currentPlan = computed(() => {
        const ws = this.currentWorkspace();
        const key = ws?.planKey || 'core_free';
        return this.corePlanLimits[key] ?? this.corePlanLimits.core_free;
    });

    currentPlanKey = computed(() => this.currentWorkspace()?.planKey || 'core_free');

    getMemberCount(workspaceId: string) {
        return this.memberCounts()[workspaceId] ?? null;
    }

    async ensureMemberCount(workspaceId: string) {
        if (!workspaceId) return;
        const existing = this.memberCounts()[workspaceId];
        if (existing !== undefined && existing !== null) return;
        try {
            const members = await this.workspacesApi.searchMembers(workspaceId);
            const activeCount = members.filter(m => m.status !== 'pending').length;
            this.memberCounts.set({ ...this.memberCounts(), [workspaceId]: activeCount });
        } catch {
            this.memberCounts.set({ ...this.memberCounts(), [workspaceId]: 0 });
        }
    }

    planUsageText = computed(() => {
        const ws = this.currentWorkspace();
        if (!ws) return `${this.tPlanBoards}: — · ${this.tPlanMembers}: —`;
        const limits = this.currentPlan();
        const boardsUsed = this.store.boards().filter(b => b.workspaceId === ws.id && !b.isArchived).length;
        const membersUsed = this.getMemberCount(ws.id);
        const boardsText = limits.maxBoards ? `${boardsUsed}/${limits.maxBoards}` : this.tPlanUnlimited;
        const membersText = membersUsed === null ? '—' : String(membersUsed);
        return `${this.tPlanBoards}: ${boardsText} · ${this.tPlanMembers}: ${membersText}`;
    });

    isPlanAtLimit = computed(() => {
        const ws = this.currentWorkspace();
        if (!ws) return false;
        const limits = this.currentPlan();
        const boardsUsed = this.store.boards().filter(b => b.workspaceId === ws.id && !b.isArchived).length;
        const membersUsed = this.getMemberCount(ws.id);
        const boardsHit = limits.maxBoards ? boardsUsed >= limits.maxBoards : false;
        const membersHit = limits.maxMembers && membersUsed !== null ? membersUsed >= limits.maxMembers : false;
        return boardsHit || membersHit;
    });

    constructor() {
        effect(() => {
            const isOpen = this.modal.isOpen();
            if (!isOpen) {
                this.initializedForOpen.set(false);
                return;
            }
            if (this.initializedForOpen()) return;
            this.initializedForOpen.set(true);
            // Reset state on open (once)
            const user = this.auth.user();
            this.name.set(user?.name || '');
            this.avatar.set(user?.avatar || '');
            this.password.set('');
            this.confirmPassword.set('');
            this.error.set(null);
            this.success.set(null);
            this.activeTab.set('profile');
            const current = getStoredLocale();
            this.locale.set(current);
            this.savedLocale.set(current);
            void this.loadWorkspaces();
        }, { allowSignalWrites: true });

        effect(() => {
            if (!this.modal.isOpen()) return;
            const ws = this.currentWorkspace();
            if (ws?.id) {
                void this.ensureMemberCount(ws.id);
            }
        }, { allowSignalWrites: true });
    }

    async loadWorkspaces() {
        if (this.loadingPlan()) return;
        this.loadingPlan.set(true);
        try {
            const list = await this.workspacesApi.list();
            this.workspaces.set(list);
            const wsId = this.currentWorkspace()?.id;
            if (wsId) {
                void this.ensureMemberCount(wsId);
            }
        } catch {
            // ignore
        } finally {
            this.loadingPlan.set(false);
        }
    }

    close() {
        this.modal.close();
    }

    async saveProfile() {
        this.error.set(null);
        this.success.set(null);
        this.isSaving.set(true);

        try {
            const user = this.auth.user();
            const profileChanged = this.name() !== (user?.name || '') || this.avatar() !== (user?.avatar || '');

            if (profileChanged) {
                await this.auth.updateProfile({
                    name: this.name(),
                    avatar: this.avatar()
                });
            }

            if (this.localeDirty()) {
                setStoredLocale(this.locale());
                this.success.set(this.tLanguageReloading);
                setTimeout(() => window.location.reload(), 400);
                return;
            }

            if (profileChanged) {
                this.success.set(this.tProfileUpdated);
                setTimeout(() => this.success.set(null), 3000);
            }
        } catch (err) {
            this.error.set(this.tFailedUpdateProfile);
        } finally {
            this.isSaving.set(false);
        }
    }

    async savePassword() {
        this.error.set(null);
        this.success.set(null);

        if (this.password() !== this.confirmPassword()) {
            this.error.set(this.tPasswordsNoMatch);
            return;
        }

        if (this.password().length < 6) {
            this.error.set(this.tPasswordTooShort);
            return;
        }

        this.isSaving.set(true);

        try {
            await this.auth.updateProfile({
                password: this.password()
            });
            this.success.set(this.tPasswordUpdated);
            this.password.set('');
            this.confirmPassword.set('');
            setTimeout(() => this.success.set(null), 3000);
        } catch (err) {
            this.error.set(this.tFailedUpdatePassword);
        } finally {
            this.isSaving.set(false);
        }
    }

    applyLanguage() {
        const next = this.locale();
        if (!next || !this.localeDirty()) return;
        setStoredLocale(next);
        this.success.set(this.tLanguageReloading);
        setTimeout(() => window.location.reload(), 400);
    }
}
