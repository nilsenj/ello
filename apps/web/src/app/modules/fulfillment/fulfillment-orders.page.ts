import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FulfillmentService, FulfillmentBoardLite } from '../../data/fulfillment.service';
import { ListsService } from '../../data/lists.service';
import type { Card, ListDto } from '../../types';

@Component({
    standalone: true,
    selector: 'fulfillment-orders-page',
    imports: [CommonModule, FormsModule],
    templateUrl: './fulfillment-orders.page.html',
})
export class FulfillmentOrdersPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private fulfillmentApi = inject(FulfillmentService);
    private listsApi = inject(ListsService);

    boards = signal<FulfillmentBoardLite[]>([]);
    selectedBoardId = signal('');
    lists = signal<ListDto[]>([]);
    loading = signal(true);
    modalOpen = signal(false);
    submitting = signal(false);
    showAll = signal(false);

    order = {
        orderNumber: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        address: '',
        itemsSummary: '',
        totalAmount: '',
        currency: 'USD',
        paidAt: '',
        carrier: '',
        trackingNumber: '',
        notes: '',
    };

    readonly tTitle = $localize`:@@fulfillment.orders.title:Orders`;
    readonly tBoardLabel = $localize`:@@fulfillment.boardLabel:Board`;
    readonly tNewOrder = $localize`:@@fulfillment.orders.newOrder:New order`;
    readonly tOrderNumber = $localize`:@@fulfillment.orderNumber:Order number`;
    readonly tCustomerName = $localize`:@@fulfillment.customerName:Customer name`;
    readonly tCustomerPhone = $localize`:@@fulfillment.customerPhone:Customer phone`;
    readonly tCustomerEmail = $localize`:@@fulfillment.customerEmail:Customer email`;
    readonly tAddress = $localize`:@@fulfillment.address:Address`;
    readonly tItems = $localize`:@@fulfillment.itemsSummary:Items`;
    readonly tTotal = $localize`:@@fulfillment.totalAmount:Total amount`;
    readonly tCurrency = $localize`:@@fulfillment.currency:Currency`;
    readonly tPaidAt = $localize`:@@fulfillment.paidAt:Paid at`;
    readonly tCarrier = $localize`:@@fulfillment.carrier:Carrier`;
    readonly tTrackingNumber = $localize`:@@fulfillment.trackingNumber:Tracking number`;
    readonly tNotes = $localize`:@@fulfillment.notes:Notes`;
    readonly tSubmit = $localize`:@@fulfillment.submitOrder:Submit order`;
    readonly tCancel = $localize`:@@fulfillment.cancel:Cancel`;
    readonly tOpenCard = $localize`:@@fulfillment.orders.openCard:Open card`;
    readonly tOrdersOnly = $localize`:@@fulfillment.orders.ordersOnly:Orders only`;
    readonly tAll = $localize`:@@fulfillment.orders.all:All`;
    readonly tStatus = $localize`:@@fulfillment.orders.status:Status`;

    workspaceId = computed(() => this.route.parent?.snapshot.paramMap.get('workspaceId') || '');

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;

        try {
            const boards = await this.fulfillmentApi.ensureBoards(workspaceId);
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

    async loadOrders(boardId: string) {
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
        const orders = lists.find(l => l.statusKey === 'order');
        if (!orders?.cards) return [];
        return orders.cards.map(c => ({ ...c, listId: orders.id, listName: orders.name }));
    }

    openModal() {
        this.modalOpen.set(true);
    }

    closeModal() {
        this.modalOpen.set(false);
    }

    async submitOrder() {
        if (this.submitting()) return;
        const boardId = this.selectedBoardId();
        if (!boardId) return;
        if (!this.order.orderNumber.trim() || !this.order.customerName.trim()) return;
        this.submitting.set(true);
        try {
            const amount = this.order.totalAmount.trim()
                ? Number(this.order.totalAmount)
                : undefined;
            const created = await this.fulfillmentApi.createOrder({
                boardId,
                orderNumber: this.order.orderNumber.trim(),
                customerName: this.order.customerName.trim(),
                customerPhone: this.order.customerPhone.trim() || undefined,
                customerEmail: this.order.customerEmail.trim() || undefined,
                address: this.order.address.trim() || undefined,
                itemsSummary: this.order.itemsSummary.trim() || undefined,
                totalAmount: Number.isNaN(amount as any) ? undefined : amount,
                currency: this.order.currency.trim() || undefined,
                paidAt: this.order.paidAt || undefined,
                carrier: this.order.carrier.trim() || undefined,
                trackingNumber: this.order.trackingNumber.trim() || undefined,
                notes: this.order.notes.trim() || undefined,
            });
            await this.loadOrders(boardId);
            this.order.orderNumber = '';
            this.order.customerName = '';
            this.order.customerPhone = '';
            this.order.customerEmail = '';
            this.order.address = '';
            this.order.itemsSummary = '';
            this.order.totalAmount = '';
            this.order.currency = 'USD';
            this.order.paidAt = '';
            this.order.carrier = '';
            this.order.trackingNumber = '';
            this.order.notes = '';
            this.closeModal();
            if (created?.id) {
                this.router.navigate(['/b', boardId], { queryParams: { card: created.id } });
            }
        } finally {
            this.submitting.set(false);
        }
    }
}
