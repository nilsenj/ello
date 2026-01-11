import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { ServiceDeskService } from '../../data/service-desk.service';
import { WorkspacesService, WorkspaceLite } from '../../data/workspaces.service';
import { UserHeaderComponent } from '../../ui/user-header/user-header.component';
import { BoardsService } from '../../data/boards.service';

@Component({
    standalone: true,
    selector: 'service-desk-page',
    imports: [CommonModule, FormsModule, RouterLink, RouterOutlet, UserHeaderComponent],
    templateUrl: './service-desk.page.html',
})
export class ServiceDeskPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private serviceDeskApi = inject(ServiceDeskService);
    private workspacesApi = inject(WorkspacesService);
    private boardsApi = inject(BoardsService);

    loading = signal(true);
    entitled = signal(false);
    workspace = signal<WorkspaceLite | null>(null);
    creatingBoard = signal(false);
    createModalOpen = signal(false);
    boardName = signal('');

    readonly tTitle = $localize`:@@serviceDesk.title:Service Desk`;
    readonly tSubtitle = $localize`:@@serviceDesk.subtitle:Requests, SLA, scheduling, and alerts for service teams.`;
    readonly tNotEntitled = $localize`:@@serviceDesk.notEntitled:Service Desk is not active for this workspace.`;
    readonly tCreateBoard = $localize`:@@serviceDesk.createBoard:Create Service Desk Board`;
    readonly tCreateBoardTitle = $localize`:@@serviceDesk.createBoard.title:New Service Desk board`;
    readonly tBoardNameLabel = $localize`:@@serviceDesk.boardNameLabel:Board name`;
    readonly tBoardNamePlaceholder = $localize`:@@serviceDesk.boardNamePlaceholder:Service Desk`;
    readonly tCreate = $localize`:@@serviceDesk.create:Create`;
    readonly tCancel = $localize`:@@serviceDesk.cancel:Cancel`;
    readonly tOverview = $localize`:@@serviceDesk.overview:Overview`;
    readonly tRequests = $localize`:@@serviceDesk.requests:Requests`;
    readonly tSla = $localize`:@@serviceDesk.sla:SLA`;
    readonly tIntegrations = $localize`:@@serviceDesk.integrations:Integrations`;
    readonly tReports = $localize`:@@serviceDesk.reports:Reports`;

    workspaceId = computed(() => this.route.snapshot.paramMap.get('workspaceId') || '');

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;

        try {
            const list = await this.workspacesApi.list();
            const ws = list.find(w => w.id === workspaceId) ?? null;

            if (!ws) {
                const existingServiceDesk = list.find(w =>
                    (w.name || '').toLowerCase().includes('service desk')
                );
                if (existingServiceDesk) {
                    await this.router.navigate(
                        ['/w', existingServiceDesk.id, 'service-desk', 'overview'],
                        { replaceUrl: true }
                    );
                    return;
                }
                await this.router.navigate(['/'], { replaceUrl: true });
                return;
            }

            const entitlement = await this.serviceDeskApi.getEntitlement(workspaceId).catch(() => null);
            this.workspace.set(ws);
            this.entitled.set(!!entitlement?.entitled);

            if (this.entitled()) {
                await this.serviceDeskApi.ensureBoards(workspaceId);
            }
        } finally {
            this.loading.set(false);
        }
    }

    openCreateBoardModal() {
        this.boardName.set('');
        this.createModalOpen.set(true);
    }

    closeCreateBoardModal() {
        this.createModalOpen.set(false);
    }

    async createBoard() {
        const workspaceId = this.workspaceId();
        if (!workspaceId || this.creatingBoard()) return;
        const name = this.boardName().trim();
        if (!name) return;
        this.creatingBoard.set(true);
        try {
            const created = await this.serviceDeskApi.bootstrap(workspaceId, name);
            await this.boardsApi.loadBoards();
            if (created?.boardId) {
                this.createModalOpen.set(false);
                this.router.navigate(['/b', created.boardId]);
            }
        } finally {
            this.creatingBoard.set(false);
        }
    }

    // Entitlements are handled via the Modules purchase flow.
}
