import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { BoardStore } from '../../store/board-store.service';
import { WorkspaceLite, WorkspacesService } from '../../data/workspaces.service';
import { BoardsService } from '../../data/boards.service';
import { ArchiveIcon, ClockIcon, LucideAngularModule, Plus, Settings, StarIcon, Users, XIcon, Upload } from 'lucide-angular';
import { BoardCreateModalComponent } from '../../components/board-create-modal/board-create-modal.component';
import { BoardCreateModalService } from '../../components/board-create-modal/board-create-modal.service';
import { WorkspaceCreateModalComponent } from '../../components/workspace-create-modal/workspace-create-modal.component';
import { WorkspaceCreateModalService } from '../../components/workspace-create-modal/workspace-create-modal.service';
import {
    WorkspaceSettingsModalComponent
} from '../../components/workspace-settings-modal/workspace-settings-modal.component';
import {
    WorkspaceSettingsModalService
} from '../../components/workspace-settings-modal/workspace-settings-modal.service';
import {
    WorkspaceSettingsAdvancedModalComponent
} from '../../components/workspace-settings-advanced-modal/workspace-settings-advanced-modal.component';
import {
    WorkspaceMembersModalComponent
} from '../../components/workspace-members-modal/workspace-members-modal.component';
import { WorkspaceMembersModalService } from '../../components/workspace-members-modal/workspace-members-modal.service';
import { TemplatesModalComponent } from '../../components/templates-modal/templates-modal.component';
import { TemplatesModalService } from '../../components/templates-modal/templates-modal.service';
import { UserHeaderComponent } from '../../ui/user-header/user-header.component';
import { WorkspaceSidebarComponent } from '../../ui/workspace-sidebar/workspace-sidebar.component';
import { ServiceDeskService } from '../../data/service-desk.service';
import { FulfillmentService } from '../../data/fulfillment.service';
import { BillingPlan, BillingService } from '../../data/billing.service';
import { UserSettingsModalService } from '../../components/user-settings-modal/user-settings-modal.service';

type ModuleWorkspace = WorkspaceLite & {
    moduleKey: 'service_desk' | 'ecommerce_fulfillment';
    status?: string | null;
    validUntil?: string | null;
};

@Component({
    standalone: true,
    selector: 'home-page',
    imports: [CommonModule, RouterModule, LucideAngularModule, BoardCreateModalComponent, WorkspaceCreateModalComponent, WorkspaceSettingsModalComponent, WorkspaceSettingsAdvancedModalComponent, WorkspaceMembersModalComponent, TemplatesModalComponent, UserHeaderComponent, WorkspaceSidebarComponent],
    templateUrl: './home-page.component.html',
    styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit {
    // Icons
    readonly SettingsIcon = Settings;
    readonly UsersIcon = Users;
    readonly ClockIcon = ClockIcon;
    readonly StarIcon = StarIcon;
    readonly PlusIcon = Plus;
    readonly UploadIcon = Upload;

    // Services
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private store = inject(BoardStore);
    private workspacesApi = inject(WorkspacesService);
    private boardsApi = inject(BoardsService);
    private createBoardModal = inject(BoardCreateModalService);
    private createWorkspaceModal = inject(WorkspaceCreateModalService);
    private settingsWorkspaceModal = inject(WorkspaceSettingsModalService);
    private membersWorkspaceModal = inject(WorkspaceMembersModalService);
    private templatesModal = inject(TemplatesModalService);
    private serviceDeskApi = inject(ServiceDeskService);
    private fulfillmentApi = inject(FulfillmentService);
    private billingApi = inject(BillingService);
    private userSettingsModal = inject(UserSettingsModalService);

    // State
    workspaces = signal<WorkspaceLite[]>([]);
    moduleWorkspaces = signal<ModuleWorkspace[]>([]);
    boards = this.store.boards; // Signal<Board[]>
    loading = signal<boolean>(true);
    sidebarOpen = signal<boolean>(false);
    modulesModalOpen = signal<boolean>(false);
    buyingModule = signal<boolean>(false);
    memberCounts = signal<Record<string, number | null>>({});
    modulePlans = signal<BillingPlan[]>([]);
    modulePlansLoading = signal<boolean>(false);
    modulePlansError = signal<string | null>(null);

    toggleSidebar() {
        this.sidebarOpen.update(v => !v);
    }

    // Recent
    recentBoards = computed(() => {
        const ids = this.recentBoardIds();
        const all = this.boards();
        return ids.map(id => all.find(b => b.id === id)).filter(Boolean) as any[];
    });
    private recentBoardIds = signal<string[]>([]);

    // Starred
    starredBoards = computed(() => {
        const ids = this.starredBoardIds();
        const all = this.boards();
        return ids.map(id => all.find(b => b.id === id)).filter(Boolean) as any[];
    });
    starredBoardIds = signal<string[]>([]);

    selectedWorkspaceId = signal<string | null>(null);
    selectedWorkspace = computed(() => {
        const id = this.selectedWorkspaceId();
        return this.workspaces().find(w => w.id === id);
    });

    // Archive Modal State
    boardToArchive = signal<string | null>(null);
    boardToArchiveName = signal<string>('');
    archivePrompt = computed(() => $localize`:@@home.archivePrompt:Archive ${this.boardToArchiveName()}:boardName:?`);

    readonly tStarredBoards = $localize`:@@home.starredBoards:Starred boards`;
    readonly tMembers = $localize`:@@home.members:Members`;
    readonly tSettings = $localize`:@@home.settings:Settings`;
    readonly tImportJson = $localize`:@@home.importJson:Import JSON`;
    readonly tCreateBoard = $localize`:@@home.createBoard:Create board`;
    readonly tWorkspaces = $localize`:@@home.workspacesButton:Workspaces`;
    readonly tArchiveTitle = $localize`:@@home.archiveTitle:Archive board`;
    readonly tArchiveHint = $localize`:@@home.archiveHint:You can restore it later from the archive view.`;
    readonly tCancel = $localize`:@@home.cancel:Cancel`;
    readonly tArchiveConfirm = $localize`:@@home.archiveConfirm:Archive`;
    readonly tServiceDesk = $localize`:@@home.serviceDesk:Service Desk`;
    readonly tFulfillment = $localize`:@@home.fulfillment:E-commerce Fulfillment`;
    readonly tModulesTitle = $localize`:@@home.modulesTitle:Available modules`;
    readonly tBuyServiceDesk = $localize`:@@home.buyServiceDesk:Buy Service Desk`;
    readonly tBuyFulfillment = $localize`:@@home.buyFulfillment:Buy Fulfillment`;
    readonly tModulesHint = $localize`:@@home.modulesHint:Each module runs in its own workspace and is billed separately.`;
    readonly tPurchased = $localize`:@@home.modulePurchased:Purchased`;
    readonly tModulesLoading = $localize`:@@home.modulesLoading:Loading plans...`;
    readonly tModulesLoadFailed = $localize`:@@home.modulesLoadFailed:Failed to load module plans.`;
    readonly tPlanLabel = $localize`:@@home.planLabel:Plan`;
    readonly tPlanCoreFree = $localize`:@@home.planCoreFree:Core Free`;
    readonly tPlanCoreTeam = $localize`:@@home.planCoreTeam:Core Team`;
    readonly tPlanCoreBusiness = $localize`:@@home.planCoreBusiness:Core Business`;
    readonly tPlanBoards = $localize`:@@home.planBoards:Boards`;
    readonly tPlanMembers = $localize`:@@home.planMembers:Members`;
    readonly tPlanExpires = $localize`:@@home.planExpires:Expires`;
    readonly tOpenModule = $localize`:@@home.openModule:Open module`;
    readonly tServiceDeskPrereq = $localize`:@@home.serviceDeskPrereq:Best for teams handling inbound requests with clear SLAs and status handoffs.`;
    readonly tFulfillmentPrereq = $localize`:@@home.fulfillmentPrereq:Best for stores that need packing, shipping, tracking, and late delivery visibility.`;
    readonly tPlanLimitReached = $localize`:@@home.planLimitReached:You reached a core plan limit. Upgrade to add more.`;
    readonly tWorkspaceLimitReached = $localize`:@@home.workspaceLimitReached:This workspace reached its limit.`;
    readonly tManagePlan = $localize`:@@home.managePlan:Manage plan`;
    readonly tViewModules = $localize`:@@home.viewModules:View modules`;
    readonly tModulesActive = $localize`:@@home.modulesActive:Modules active`;
    readonly tPlanUnlimited = $localize`:@@home.planUnlimited:Unlimited`;

    readonly corePlanLimits: Record<string, { maxBoards?: number; maxMembers?: number; label: string }> = {
        core_free: { maxBoards: 3, maxMembers: 5, label: this.tPlanCoreFree },
        core_team: { maxBoards: 10, maxMembers: 10, label: this.tPlanCoreTeam },
        core_business: { maxBoards: 50, maxMembers: 50, label: this.tPlanCoreBusiness },
    };

    async ngOnInit() {
        this.loadRecentIds();
        this.loadStarredIds();

        try {
            // Load initial data
            await Promise.all([
                this.loadWorkspaces(),
                this.boardsApi.loadBoards()
            ]);
        } finally {
            this.loading.set(false);
        }

        // Subscribe to route params to update selected workspace
        this.route.paramMap.subscribe(params => {
            const wsId = params.get('workspaceId');
            if (wsId) {
                this.selectedWorkspaceId.set(wsId);
                void this.ensureMemberCount(wsId);
            } else if (this.workspaces().length > 0 && !this.selectedWorkspaceId()) {
                // If no param but we have workspaces, default to first (and maybe redirect?)
                // For now, just set it locally or redirect to /w/:id
                const first = this.workspaces()[0];
                this.router.navigate(['/w', first.id], { replaceUrl: true });
            }
        });
    }

    private loadRecentIds() {
        if (typeof window !== 'undefined') {
            try {
                const recent: string[] = JSON.parse(localStorage.getItem('recent_boards') || '[]');
                this.recentBoardIds.set(recent);
            } catch (e) { /* noop */ }
        }
    }

    private loadStarredIds() {
        if (typeof window !== 'undefined') {
            try {
                const starred: string[] = JSON.parse(localStorage.getItem('starred_boards') || '[]');
                this.starredBoardIds.set(starred);
            } catch (e) { /* noop */ }
        }
    }

    isStarred(boardId: string) {
        return this.starredBoardIds().includes(boardId);
    }

    toggleStar(event: Event, boardId: string) {
        event.preventDefault();
        event.stopPropagation();

        const current = this.starredBoardIds();
        let next: string[];

        if (current.includes(boardId)) {
            next = current.filter(id => id !== boardId);
        } else {
            next = [boardId, ...current];
        }

        this.starredBoardIds.set(next);

        if (typeof window !== 'undefined') {
            localStorage.setItem('starred_boards', JSON.stringify(next));
        }
    }

    async loadWorkspaces() {
        const list = await this.workspacesApi.list();
        this.workspaces.set(list);
        await this.loadModuleWorkspaces(list);
        if (!this.selectedWorkspaceId() && list.length) {
            this.selectedWorkspaceId.set(list[0].id);
        }
        const currentId = this.selectedWorkspaceId();
        if (currentId) {
            void this.ensureMemberCount(currentId);
        }
    }

    onWorkspaceSelected(id: string) {
        this.router.navigate(['/w', id]);
    }

    openModuleWorkspace(ws: ModuleWorkspace) {
        if (!ws?.id) return;
        if (ws.moduleKey === 'ecommerce_fulfillment') {
            this.router.navigate(['/w', ws.id, 'ecommerce-fulfillment']);
            return;
        }
        this.router.navigate(['/w', ws.id, 'service-desk']);
    }

    openModulesModal() {
        this.modulesModalOpen.set(true);
        void this.loadModulePlans();
    }

    closeModulesModal() {
        this.modulesModalOpen.set(false);
    }

    serviceDeskPlans = computed(() => {
        return this.modulePlans().filter(plan => plan.kind === 'module' && plan.moduleKey === 'service_desk');
    });
    fulfillmentPlans = computed(() => {
        return this.modulePlans().filter(plan => plan.kind === 'module' && plan.moduleKey === 'ecommerce_fulfillment');
    });
    serviceDeskPlan = computed(() => this.serviceDeskPlans()[0] ?? null);
    fulfillmentPlan = computed(() => this.fulfillmentPlans()[0] ?? null);

    serviceDeskSummary = computed(() => this.getModuleSummary('service_desk'));
    fulfillmentSummary = computed(() => this.getModuleSummary('ecommerce_fulfillment'));

    async loadModuleWorkspaces(list: WorkspaceLite[]) {
        const checks = await Promise.all(list.map(async ws => {
            const [serviceDesk, fulfillment] = await Promise.all([
                this.serviceDeskApi.getEntitlement(ws.id).catch(() => ({ entitled: false, status: null, validUntil: null })),
                this.fulfillmentApi.getEntitlement(ws.id).catch(() => ({ entitled: false, status: null, validUntil: null })),
            ]);
            return {
                ws,
                serviceDesk,
                fulfillment,
            };
        }));
        const moduleWorkspaces: ModuleWorkspace[] = [];
        for (const row of checks) {
            if (row.ws.isPersonal && row.serviceDesk?.entitled) {
                moduleWorkspaces.push({
                    ...row.ws,
                    moduleKey: 'service_desk',
                    status: row.serviceDesk?.status ?? null,
                    validUntil: row.serviceDesk?.validUntil ?? null,
                });
            }
            if (row.ws.isPersonal && row.fulfillment?.entitled) {
                moduleWorkspaces.push({
                    ...row.ws,
                    moduleKey: 'ecommerce_fulfillment',
                    status: row.fulfillment?.status ?? null,
                    validUntil: row.fulfillment?.validUntil ?? null,
                });
            }
        }
        this.moduleWorkspaces.set(moduleWorkspaces);
    }

    hasServiceDeskModule() {
        return this.moduleWorkspaces().some(ws => ws.moduleKey === 'service_desk');
    }

    hasFulfillmentModule() {
        return this.moduleWorkspaces().some(ws => ws.moduleKey === 'ecommerce_fulfillment');
    }

    private getModuleSummary(moduleKey: ModuleWorkspace['moduleKey']) {
        const items = this.moduleWorkspaces().filter(ws => ws.moduleKey === moduleKey);
        const expiries = items
            .map(ws => ws.validUntil)
            .filter((value): value is string => !!value)
            .map(value => new Date(value).getTime())
            .filter(value => Number.isFinite(value));
        const nextExpiry = expiries.length ? new Date(Math.min(...expiries)).toISOString() : null;
        return {
            active: items.length > 0,
            count: items.length,
            nextExpiry,
        };
    }

    formatModuleDate(value?: string | null) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString();
    }

    openModuleByKey(moduleKey: ModuleWorkspace['moduleKey']) {
        const ws = this.moduleWorkspaces().find(item => item.moduleKey === moduleKey);
        if (ws) {
            this.openModuleWorkspace(ws);
        }
    }

    async buyServiceDeskModule(plan: BillingPlan) {
        if (this.buyingModule()) return;
        this.buyingModule.set(true);
        try {
            await this.billingApi.purchasePlan(undefined, plan);
        } finally {
            this.buyingModule.set(false);
        }
    }

    async buyFulfillmentModule(plan: BillingPlan) {
        if (this.buyingModule()) return;
        this.buyingModule.set(true);
        try {
            await this.billingApi.purchasePlan(undefined, plan);
        } finally {
            this.buyingModule.set(false);
        }
    }

    async loadModulePlans() {
        if (this.modulePlansLoading()) return;
        this.modulePlansLoading.set(true);
        this.modulePlansError.set(null);
        try {
            const plans = await this.billingApi.listPlans();
            this.modulePlans.set(plans);
        } catch {
            this.modulePlansError.set(this.tModulesLoadFailed);
        } finally {
            this.modulePlansLoading.set(false);
        }
    }

    formatPlanPrice(plan: BillingPlan): string {
        const value = plan.priceCents / 100;
        const formatted = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: plan.currency,
            minimumFractionDigits: value % 1 === 0 ? 0 : 2,
            maximumFractionDigits: value % 1 === 0 ? 0 : 2,
        }).format(value);
        return `${formatted} /${plan.interval}`;
    }

    getBoardsForWorkspace(workspaceId: string) {
        return this.boards().filter(b => b.workspaceId === workspaceId && !b.isArchived);
    }

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

    isModuleWorkspace(ws: WorkspaceLite) {
        return this.moduleWorkspaces().some(m => m.id === ws.id);
    }

    getPlanLabel(ws: WorkspaceLite) {
        const key = ws.planKey || 'core_free';
        return this.corePlanLimits[key]?.label ?? this.tPlanCoreFree;
    }

    getPlanLimits(ws: WorkspaceLite) {
        const key = ws.planKey || 'core_free';
        const base = this.corePlanLimits[key] ?? this.corePlanLimits.core_free;
        if (this.isModuleWorkspace(ws)) {
            return { ...base, maxBoards: undefined, maxMembers: undefined };
        }
        return base;
    }

    planUsageText(ws: WorkspaceLite) {
        const limits = this.getPlanLimits(ws);
        const boardsUsed = this.getBoardsForWorkspace(ws.id).length;
        const membersUsed = this.getMemberCount(ws.id);
        const boardsText = limits.maxBoards ? `${boardsUsed}/${limits.maxBoards}` : this.tPlanUnlimited;
        const membersText = membersUsed === null ? '—' : String(membersUsed);
        return `${this.tPlanBoards}: ${boardsText} · ${this.tPlanMembers}: ${membersText}`;
    }

    isPlanAtLimit(ws: WorkspaceLite) {
        if (this.isModuleWorkspace(ws)) return false;
        const limits = this.getPlanLimits(ws);
        const boardsUsed = this.getBoardsForWorkspace(ws.id).length;
        const membersUsed = this.getMemberCount(ws.id);
        const boardsHit = limits.maxBoards ? boardsUsed >= limits.maxBoards : false;
        const membersHit = limits.maxMembers && membersUsed !== null ? membersUsed >= limits.maxMembers : false;
        return boardsHit || membersHit;
    }

    getBoardBackground(board: any): string {
        const bg = board?.background;

        const bgMap: Record<string, string> = {
            'none': 'bg-slate-50',
            'blue': 'bg-blue-500',
            'green': 'bg-green-500',
            'purple': 'bg-purple-500',
            'red': 'bg-red-500',
            'orange': 'bg-orange-500',
            'pink': 'bg-pink-500',
            'gradient-blue': 'bg-gradient-to-br from-blue-400 to-cyan-500',
            'gradient-purple': 'bg-gradient-to-br from-purple-400 to-pink-500',
            'gradient-sunset': 'bg-gradient-to-br from-orange-400 to-red-500',
            'gradient-forest': 'bg-gradient-to-br from-green-400 to-emerald-600',
            'gradient-ocean': 'bg-gradient-to-br from-cyan-500 to-blue-700',
        };

        return bg && bgMap[bg] ? bgMap[bg] : 'bg-slate-50';
    }

    getBoardTextColor(board: any): string {
        const bg = board?.background;
        // if background is 'none' (or undefined/null which defaults to slate-50), use dark text
        if (!bg || bg === 'none') {
            return 'text-slate-700';
        }
        // otherwise (colored backgrounds), use white text
        return 'text-white';
    }

    openCreateBoard(workspaceId?: string) {
        this.createBoardModal.open(workspaceId);
    }

    openCreateWorkspace() {
        this.createWorkspaceModal.open();
    }

    openWorkspaceSettings(workspace: WorkspaceLite) {
        this.settingsWorkspaceModal.open(workspace);
    }

    openWorkspaceMembers(workspace: WorkspaceLite) {
        this.membersWorkspaceModal.open(workspace);
    }

    canCreateBoard(ws: WorkspaceLite): boolean {
        // console.log('canCreateBoard check:', ws.name, ws.whoCanCreateBoards, ws.role);
        if (ws.whoCanCreateBoards === 'admins') {
            return ws.role === 'owner' || ws.role === 'admin';
        }
        return true;
    }

    canEditWorkspace(ws: WorkspaceLite): boolean {
        return ws.role === 'owner' || ws.role === 'admin';
    }

    canInviteMembers(ws: WorkspaceLite): boolean {
        if (ws.whoCanInviteMembers === 'admins') {
            return ws.role === 'owner' || ws.role === 'admin';
        }
        return true;
    }

    openTemplates() {
        this.templatesModal.open();
    }

    openAccountSettings(tab: 'profile' | 'security' | 'plan' = 'profile', workspaceId?: string) {
        this.userSettingsModal.open(tab, workspaceId);
    }

    canArchiveBoard(ws: WorkspaceLite): boolean {
        // Workspace admins/owners can archive any board in the workspace
        return ws.role === 'owner' || ws.role === 'admin';
    }


    requestArchiveBoard(event: Event, board: any) {
        event.preventDefault();
        event.stopPropagation();
        this.boardToArchive.set(board.id);
        this.boardToArchiveName.set(board.name);
    }

    openBoard(boardId: string, event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (target.closest('button,[data-stop-open]')) return;
        this.router.navigate(['/b', boardId]);
    }

    async importBoardToWorkspace(event: Event, workspaceId: string) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            const board = await this.boardsApi.importBoard(workspaceId, payload);
            this.router.navigate(['/b', board.id]);
        } catch (err) {
            console.error('Failed to import board', err);
            alert('Failed to import board');
        } finally {
            input.value = '';
        }
    }

    closeArchiveModal() {
        this.boardToArchive.set(null);
        this.boardToArchiveName.set('');
    }

    async confirmArchive() {
        const boardId = this.boardToArchive();
        if (!boardId) return;

        try {
            await this.boardsApi.updateBoard(boardId, { isArchived: true });
            await this.boardsApi.loadBoards();
            this.closeArchiveModal();
        } catch (err) {
            console.error('Failed to archive board', err);
            alert('Failed to archive board');
        }
    }

    protected readonly ArchiveIcon = ArchiveIcon;
    protected readonly XIcon = XIcon;
}
