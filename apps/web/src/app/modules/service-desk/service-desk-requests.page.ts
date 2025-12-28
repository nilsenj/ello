import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ServiceDeskService, ServiceDeskBoardLite } from '../../data/service-desk.service';
import { ListsService } from '../../data/lists.service';
import type { Card, ListDto } from '../../types';

@Component({
    standalone: true,
    selector: 'service-desk-requests-page',
    imports: [CommonModule, FormsModule],
    templateUrl: './service-desk-requests.page.html',
})
export class ServiceDeskRequestsPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private serviceDeskApi = inject(ServiceDeskService);
    private listsApi = inject(ListsService);

    boards = signal<ServiceDeskBoardLite[]>([]);
    selectedBoardId = signal('');
    lists = signal<ListDto[]>([]);
    loading = signal(true);
    modalOpen = signal(false);
    submitting = signal(false);
    showAll = signal(false);

    request = {
        customerName: '',
        customerPhone: '',
        address: '',
        serviceType: '',
        notes: '',
        scheduledAt: '',
    };

    readonly tTitle = $localize`:@@serviceDesk.requests.title:Requests`;
    readonly tBoardLabel = $localize`:@@serviceDesk.boardLabel:Board`;
    readonly tNewRequest = $localize`:@@serviceDesk.requests.newRequest:New request`;
    readonly tCustomerName = $localize`:@@serviceDesk.customerName:Customer name`;
    readonly tCustomerPhone = $localize`:@@serviceDesk.customerPhone:Customer phone`;
    readonly tAddress = $localize`:@@serviceDesk.address:Address`;
    readonly tServiceType = $localize`:@@serviceDesk.serviceType:Service type`;
    readonly tNotes = $localize`:@@serviceDesk.notes:Notes`;
    readonly tScheduledAt = $localize`:@@serviceDesk.scheduledAt:Scheduled at`;
    readonly tSubmit = $localize`:@@serviceDesk.submitRequest:Submit request`;
    readonly tCancel = $localize`:@@serviceDesk.cancel:Cancel`;
    readonly tOpenCard = $localize`:@@serviceDesk.requests.openCard:Open card`;
    readonly tInboxOnly = $localize`:@@serviceDesk.requests.inboxOnly:Inbox only`;
    readonly tAll = $localize`:@@serviceDesk.requests.all:All`;
    readonly tStatus = $localize`:@@serviceDesk.requests.status:Status`;

    workspaceId = computed(() => this.route.parent?.snapshot.paramMap.get('workspaceId') || '');

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;

        try {
            const boards = await this.serviceDeskApi.ensureBoards(workspaceId);
            this.boards.set(boards);
            if (boards.length) {
                this.selectedBoardId.set(boards[0].id);
                await this.loadBoardLists(boards[0].id);
            }
        } finally {
            this.loading.set(false);
        }
    }

    async loadBoardLists(boardId: string) {
        if (!boardId) return;
        const lists = await this.listsApi.fetchLists(boardId);
        this.lists.set(lists);
    }

    async loadInbox(boardId: string) {
        await this.loadBoardLists(boardId);
    }

    cards(): Array<Card & { listName: string }> {
        const lists = this.lists();
        if (!lists.length) return [];
        if (this.showAll()) {
            return lists.flatMap(list => (list.cards || []).map(c => ({
                ...c,
                listId: list.id,
                listName: list.name,
            })));
        }
        const inbox = lists.find(l => l.statusKey === 'inbox');
        if (!inbox?.cards) return [];
        return inbox.cards.map(c => ({ ...c, listId: inbox.id, listName: inbox.name }));
    }

    openModal() {
        this.modalOpen.set(true);
    }

    closeModal() {
        this.modalOpen.set(false);
    }

    async submitRequest() {
        if (this.submitting()) return;
        const boardId = this.selectedBoardId();
        if (!boardId) return;
        if (!this.request.customerName.trim() || !this.request.customerPhone.trim()) return;
        this.submitting.set(true);
        try {
            const created = await this.serviceDeskApi.createRequest({
                boardId,
                customerName: this.request.customerName.trim(),
                customerPhone: this.request.customerPhone.trim(),
                address: this.request.address.trim() || undefined,
                serviceType: this.request.serviceType.trim() || undefined,
                notes: this.request.notes.trim() || undefined,
                scheduledAt: this.request.scheduledAt || undefined,
            });
            await this.loadInbox(boardId);
            this.request.customerName = '';
            this.request.customerPhone = '';
            this.request.address = '';
            this.request.serviceType = '';
            this.request.notes = '';
            this.closeModal();
            if (created?.id) {
                this.router.navigate(['/b', boardId], { queryParams: { card: created.id } });
            }
        } finally {
            this.submitting.set(false);
        }
    }
}
