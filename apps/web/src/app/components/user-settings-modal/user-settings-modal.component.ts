import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, X, User, Lock, Save, CreditCard } from 'lucide-angular';
import { UserSettingsModalService } from './user-settings-modal.service';
import { AuthService } from '../../auth/auth.service';
import { LOCALE_LABELS, SUPPORTED_LOCALES, getStoredLocale, setStoredLocale } from '../../i18n/i18n';
import { WorkspacesService, WorkspaceLite } from '../../data/workspaces.service';
import { BoardStore } from '../../store/board-store.service';
import { BillingPlan, BillingService } from '../../data/billing.service';
import { ServiceDeskEntitlement, ServiceDeskService } from '../../data/service-desk.service';
import { FulfillmentEntitlement, FulfillmentService } from '../../data/fulfillment.service';

type ModuleKey = 'service_desk' | 'ecommerce_fulfillment';
type ModuleEntitlement = ServiceDeskEntitlement | FulfillmentEntitlement;
type ModuleEntitlements = Record<string, Partial<Record<ModuleKey, ModuleEntitlement>>>;

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
    billingApi = inject(BillingService);
    serviceDeskApi = inject(ServiceDeskService);
    fulfillmentApi = inject(FulfillmentService);

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
    readonly tPlanAppliesTo = $localize`:@@settings.planAppliesTo:Plan applies to Workspace`;
    readonly tPlanModuleServiceDesk = $localize`:@@settings.planModuleServiceDesk:Service Desk module`;
    readonly tPlanModuleFulfillment = $localize`:@@settings.planModuleFulfillment:E-commerce Fulfillment module`;
    readonly tPlanModuleNote = $localize`:@@settings.planModuleNote:Core plan limits do not apply to module workspaces.`;
    readonly tPlanCoreFree = $localize`:@@settings.planCoreFree:Core Free`;
    readonly tPlanCoreTeam = $localize`:@@settings.planCoreTeam:Core Team`;
    readonly tPlanCoreBusiness = $localize`:@@settings.planCoreBusiness:Core Business`;
    readonly tPlanBoards = $localize`:@@settings.planBoards:Boards`;
    readonly tPlanMembers = $localize`:@@settings.planMembers:Members`;
    readonly tPlanUnlimited = $localize`:@@settings.planUnlimited:Unlimited`;
    readonly tPlanCurrent = $localize`:@@settings.planCurrent:Current`;
    readonly tPlanComingSoon = $localize`:@@settings.planComingSoon:Coming soon`;
    readonly tPlanAvailable = $localize`:@@settings.planAvailable:Available upgrades`;
    readonly tPlanModulesBilling = $localize`:@@settings.planModulesBilling:Modules are billed per workspace.`;
    readonly tPlanLimitReached = $localize`:@@settings.planLimitReached:You reached a core plan limit. Upgrade to add more.`;
    readonly tPlanFree = $localize`:@@settings.planFree:Free`;
    readonly tPlanPerMonth = $localize`:@@settings.planPerMonth:/month`;
    readonly tPlanPerYear = $localize`:@@settings.planPerYear:/year`;
    readonly tPlanBuy = $localize`:@@settings.planBuy:Buy`;
    readonly tPlanProcessing = $localize`:@@settings.planProcessing:Processing...`;
    readonly tPlanLoading = $localize`:@@settings.planLoading:Loading plans...`;
    readonly tPlanLoadFailed = $localize`:@@settings.planLoadFailed:Failed to load plans.`;
    readonly tPlanPurchaseSuccess = $localize`:@@settings.planPurchaseSuccess:Plan updated.`;
    readonly tPlanPurchaseFailed = $localize`:@@settings.planPurchaseFailed:Failed to start checkout.`;
    readonly tPlanIapIds = $localize`:@@settings.planIapIds:IAP IDs`;
    readonly tPlanAdminOnly = $localize`:@@settings.planAdminOnly:Only admins can purchase plans for this workspace.`;
    readonly tPlanRenewsOn = $localize`:@@settings.planRenewsOn:Renews on`;
    readonly tPlanExpiresOn = $localize`:@@settings.planExpiresOn:Expires on`;

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
    plans = signal<BillingPlan[]>([]);
    plansLoading = signal(false);
    planError = signal<string | null>(null);
    planSuccess = signal<string | null>(null);
    purchasingPlan = signal<string | null>(null);
    planWorkspaceId = signal<string | null>(null);
    moduleEntitlements = signal<ModuleEntitlements>({});

    readonly corePlanLimits: Record<string, { maxBoards?: number; maxMembers?: number; label: string }> = {
        core_free: { maxBoards: 3, maxMembers: 5, label: this.tPlanCoreFree },
        core_team: { maxBoards: 10, maxMembers: 10, label: this.tPlanCoreTeam },
        core_business: { maxBoards: 50, maxMembers: 50, label: this.tPlanCoreBusiness },
    };
    availablePlans = computed(() => this.plans().filter(plan => plan.kind !== 'module'));

    currentWorkspace = computed(() => {
        const list = this.workspaces();
        const preferredId = this.planWorkspaceId();
        if (preferredId) {
            const found = list.find(w => w.id === preferredId);
            if (found) return found;
        }
        const boardId = this.store.currentBoardId();
        const board = this.store.boards().find(b => b.id === boardId);
        const wsId = board?.workspaceId ?? list[0]?.id;
        if (!wsId) return null;
        return list.find(w => w.id === wsId) ?? null;
    });

    plansByKey = computed(() => {
        const map: Record<string, BillingPlan> = {};
        for (const plan of this.plans()) {
            map[plan.key] = plan;
        }
        return map;
    });

    modulePlan = computed(() => {
        const key = this.moduleKey();
        if (!key) return null;
        return this.plansByKey()[key] ?? null;
    });

    private fallbackPlan(planKey: string): BillingPlan {
        const fallback = this.corePlanLimits[planKey] ?? this.corePlanLimits.core_free;
        return {
            key: planKey,
            name: fallback.label,
            priceCents: 0,
            currency: 'USD',
            interval: 'month',
            limits: {
                maxBoards: fallback.maxBoards,
                maxMembers: fallback.maxMembers,
            },
            iapProductIds: { ios: null, android: null },
            purchasable: false,
        };
    }

    currentPlan = computed(() => {
        const ws = this.currentWorkspace();
        const key = ws?.planKey || 'core_free';
        return this.plansByKey()[key] ?? this.fallbackPlan(key);
    });

    currentPlanKey = computed(() => this.currentWorkspace()?.planKey || 'core_free');
    canPurchasePlan = computed(() => {
        const role = this.currentWorkspace()?.role;
        return role === 'owner' || role === 'admin';
    });
    moduleKey = computed<ModuleKey | null>(() => {
        const ws = this.currentWorkspace();
        if (!ws?.id) return null;
        if (ws.planKey === 'service_desk' || ws.planKey === 'ecommerce_fulfillment') {
            return ws.planKey;
        }
        const entitlements = this.moduleEntitlements()[ws.id];
        if (entitlements?.ecommerce_fulfillment?.entitled) return 'ecommerce_fulfillment';
        if (entitlements?.service_desk?.entitled) return 'service_desk';
        return null;
    });
    isModuleWorkspace = computed(() => this.moduleKey() !== null);

    moduleTitle = computed(() => {
        const key = this.moduleKey();
        if (key === 'ecommerce_fulfillment') return this.tPlanModuleFulfillment;
        if (key === 'service_desk') return this.tPlanModuleServiceDesk;
        return null;
    });

    corePlanEndText = computed(() => {
        if (this.isModuleWorkspace()) return null;
        const end = this.currentWorkspace()?.subscription?.currentPeriodEnd;
        if (!end) return null;
        return `${this.tPlanRenewsOn} ${this.formatDate(end)}`;
    });

    modulePlanEndText = computed(() => {
        const key = this.moduleKey();
        if (!key) return null;
        const ws = this.currentWorkspace();
        if (!ws?.id) return null;
        const end = this.moduleEntitlements()[ws.id]?.[key]?.validUntil;
        if (!end) return null;
        return `${this.tPlanExpiresOn} ${this.formatDate(end)}`;
    });

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
        if (this.isModuleWorkspace()) {
            return `${this.tPlanBoards}: ${this.tPlanUnlimited} · ${this.tPlanMembers}: ${this.tPlanUnlimited}`;
        }
        const limits = this.currentPlan().limits;
        const boardsUsed = this.store.boards().filter(b => b.workspaceId === ws.id && !b.isArchived).length;
        const membersUsed = this.getMemberCount(ws.id);
        const boardsText = limits.maxBoards ? `${boardsUsed}/${limits.maxBoards}` : this.tPlanUnlimited;
        const membersCount = membersUsed === null ? '—' : String(membersUsed);
        const membersText = limits.maxMembers ? `${membersCount}/${limits.maxMembers}` : this.tPlanUnlimited;
        return `${this.tPlanBoards}: ${boardsText} · ${this.tPlanMembers}: ${membersText}`;
    });

    isPlanAtLimit = computed(() => {
        const ws = this.currentWorkspace();
        if (!ws) return false;
        if (this.isModuleWorkspace()) return false;
        const limits = this.currentPlan().limits;
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
                this.planWorkspaceId.set(null);
                return;
            }
            if (this.initializedForOpen()) return;
            this.initializedForOpen.set(true);
            // Reset state on open (once)
            const user = this.auth.user();
            const boardId = this.store.currentBoardId();
            const board = this.store.boards().find(b => b.id === boardId);
            this.name.set(user?.name || '');
            this.avatar.set(user?.avatar || '');
            this.password.set('');
            this.confirmPassword.set('');
            this.error.set(null);
            this.success.set(null);
            this.planError.set(null);
            this.planSuccess.set(null);
            this.activeTab.set(this.modal.initialTab() ?? 'profile');
            this.planWorkspaceId.set(this.modal.initialWorkspaceId() ?? board?.workspaceId ?? null);
            const current = getStoredLocale();
            this.locale.set(current);
            this.savedLocale.set(current);
            void this.loadWorkspaces();
            void this.loadPlans();
        }, { allowSignalWrites: true });

        effect(() => {
            if (!this.modal.isOpen()) return;
            const ws = this.currentWorkspace();
            if (ws?.id) {
                void this.ensureMemberCount(ws.id);
                void this.ensureModuleEntitlements(ws.id);
            }
        }, { allowSignalWrites: true });
    }

    async loadWorkspaces() {
        if (this.loadingPlan()) return;
        this.loadingPlan.set(true);
        try {
            const list = await this.workspacesApi.list();
            this.workspaces.set(list);
            const preferredId = this.planWorkspaceId();
            if (preferredId && !list.find(item => item.id === preferredId) && list.length) {
                this.planWorkspaceId.set(list[0].id);
            } else if (!preferredId && list.length) {
                this.planWorkspaceId.set(list[0].id);
            }
            const wsId = this.currentWorkspace()?.id;
            if (wsId) {
                void this.ensureMemberCount(wsId);
                void this.ensureModuleEntitlements(wsId);
            }
        } catch {
            // ignore
        } finally {
            this.loadingPlan.set(false);
        }
    }

    async loadPlans() {
        if (this.plansLoading()) return;
        this.plansLoading.set(true);
        this.planError.set(null);
        try {
            const list = await this.billingApi.listPlans();
            this.plans.set(list);
        } catch {
            this.planError.set(this.tPlanLoadFailed);
        } finally {
            this.plansLoading.set(false);
        }
    }

    async ensureModuleEntitlements(workspaceId: string) {
        if (!workspaceId) return;
        const existing = this.moduleEntitlements()[workspaceId];
        const hasServiceDesk = existing?.service_desk !== undefined;
        const hasFulfillment = existing?.ecommerce_fulfillment !== undefined;
        if (hasServiceDesk && hasFulfillment) return;
        try {
            const [serviceDesk, fulfillment] = await Promise.all([
                hasServiceDesk ? Promise.resolve(existing?.service_desk) : this.serviceDeskApi.getEntitlement(workspaceId),
                hasFulfillment ? Promise.resolve(existing?.ecommerce_fulfillment) : this.fulfillmentApi.getEntitlement(workspaceId),
            ]);
            this.moduleEntitlements.set({
                ...this.moduleEntitlements(),
                [workspaceId]: {
                    service_desk: serviceDesk ?? existing?.service_desk,
                    ecommerce_fulfillment: fulfillment ?? existing?.ecommerce_fulfillment,
                },
            });
        } catch {
            this.moduleEntitlements.set({
                ...this.moduleEntitlements(),
                [workspaceId]: {
                    service_desk: existing?.service_desk ?? { entitled: false, status: null, validUntil: null },
                    ecommerce_fulfillment: existing?.ecommerce_fulfillment ?? { entitled: false, status: null, validUntil: null },
                },
            });
        }
    }

    planPriceText(plan: BillingPlan): string {
        if (!plan.priceCents) return this.tPlanFree;
        const value = plan.priceCents / 100;
        const formatted = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: plan.currency,
            minimumFractionDigits: value % 1 === 0 ? 0 : 2,
            maximumFractionDigits: value % 1 === 0 ? 0 : 2,
        }).format(value);
        const interval = plan.interval === 'year' ? this.tPlanPerYear : this.tPlanPerMonth;
        return `${formatted} ${interval}`;
    }

    private formatDate(value: string | Date): string {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(date);
    }

    async buyPlan(plan: BillingPlan) {
        const ws = this.currentWorkspace();
        if (!ws || !plan?.purchasable) return;
        if (!this.canPurchasePlan()) return;
        if (this.purchasingPlan()) return;
        if (plan.key === this.currentPlanKey()) return;
        this.planError.set(null);
        this.planSuccess.set(null);
        this.purchasingPlan.set(plan.key);
        try {
            const res = await this.billingApi.purchasePlan(ws.id, plan);
            if (res?.status === 'paid') {
                const list = await this.workspacesApi.list({ force: true });
                this.workspaces.set(list);
                this.planSuccess.set(this.tPlanPurchaseSuccess);
                setTimeout(() => this.planSuccess.set(null), 3000);
            }
        } catch {
            this.planError.set(this.tPlanPurchaseFailed);
        } finally {
            this.purchasingPlan.set(null);
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
