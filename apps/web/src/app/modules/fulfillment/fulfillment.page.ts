import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { FulfillmentService } from '../../data/fulfillment.service';
import { WorkspacesService, WorkspaceLite } from '../../data/workspaces.service';
import { UserHeaderComponent } from '../../ui/user-header/user-header.component';
import { BoardsService } from '../../data/boards.service';

@Component({
    standalone: true,
    selector: 'fulfillment-page',
    imports: [CommonModule, FormsModule, RouterLink, RouterOutlet, UserHeaderComponent],
    templateUrl: './fulfillment.page.html',
})
export class FulfillmentPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private fulfillmentApi = inject(FulfillmentService);
    private workspacesApi = inject(WorkspacesService);
    private boardsApi = inject(BoardsService);

    loading = signal(true);
    entitled = signal(false);
    workspace = signal<WorkspaceLite | null>(null);
    creatingBoard = signal(false);
    createModalOpen = signal(false);
    boardName = signal('');

    readonly tTitle = $localize`:@@fulfillment.title:E-commerce Fulfillment`;
    readonly tSubtitle = $localize`:@@fulfillment.subtitle:Orders, packing, shipping, and delivery tracking in one place.`;
    readonly tNotEntitled = $localize`:@@fulfillment.notEntitled:Fulfillment module is not active for this workspace.`;
    readonly tCreateBoard = $localize`:@@fulfillment.createBoard:Create Fulfillment Board`;
    readonly tCreateBoardTitle = $localize`:@@fulfillment.createBoard.title:New fulfillment board`;
    readonly tBoardNameLabel = $localize`:@@fulfillment.boardNameLabel:Board name`;
    readonly tBoardNamePlaceholder = $localize`:@@fulfillment.boardNamePlaceholder:Fulfillment`;
    readonly tCreate = $localize`:@@fulfillment.create:Create`;
    readonly tCancel = $localize`:@@fulfillment.cancel:Cancel`;
    readonly tOverview = $localize`:@@fulfillment.overview:Overview`;
    readonly tOrders = $localize`:@@fulfillment.orders:Orders`;
    readonly tSla = $localize`:@@fulfillment.sla:SLA`;
    readonly tIntegrations = $localize`:@@fulfillment.integrations:Integrations`;
    readonly tReports = $localize`:@@fulfillment.reports:Reports`;

    workspaceId = computed(() => this.route.snapshot.paramMap.get('workspaceId') || '');

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;

        try {
            const list = await this.workspacesApi.list();
            const ws = list.find(w => w.id === workspaceId) ?? null;

            if (!ws) {
                const existingFulfillment = list.find(w =>
                    (w.name || '').toLowerCase().includes('fulfillment')
                );
                if (existingFulfillment) {
                    await this.router.navigate(
                        ['/w', existingFulfillment.id, 'ecommerce-fulfillment', 'overview'],
                        { replaceUrl: true }
                    );
                    return;
                }
                await this.router.navigate(['/'], { replaceUrl: true });
                return;
            }

            const entitlement = await this.fulfillmentApi.getEntitlement(workspaceId).catch(() => null);
            this.workspace.set(ws);
            this.entitled.set(!!entitlement?.entitled);

            if (this.entitled()) {
                await this.fulfillmentApi.ensureBoards(workspaceId);
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
            const created = await this.fulfillmentApi.bootstrap(workspaceId, name);
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
