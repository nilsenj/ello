import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FulfillmentService, FulfillmentBoardLite } from '../../data/fulfillment.service';
import { ListsService } from '../../data/lists.service';
import type { Card, ListDto } from '../../types';

@Component({
    standalone: true,
    selector: 'fulfillment-overview-page',
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './fulfillment-overview.page.html',
})
export class FulfillmentOverviewPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private fulfillmentApi = inject(FulfillmentService);
    private listsApi = inject(ListsService);

    boards = signal<FulfillmentBoardLite[]>([]);
    selectedBoardId = signal('');
    lists = signal<ListDto[]>([]);
    slaRules = signal<Record<string, number>>({});

    loading = signal(true);

    readonly tOverview = $localize`:@@fulfillment.overview.title:Module overview`;
    readonly tOrders = $localize`:@@fulfillment.overview.orders:Orders`;
    readonly tOverdue = $localize`:@@fulfillment.overview.overdue:Overdue`;
    readonly tShipped = $localize`:@@fulfillment.overview.shipped:Shipped`;
    readonly tDelivered = $localize`:@@fulfillment.overview.delivered:Delivered`;
    readonly tBoardLabel = $localize`:@@fulfillment.boardLabel:Board`;
    readonly tOpenOrders = $localize`:@@fulfillment.overview.openOrders:Open orders`;
    readonly tQuickLinks = $localize`:@@fulfillment.overview.quickLinks:Quick actions`;
    readonly tGoOrders = $localize`:@@fulfillment.overview.goOrders:View orders`;
    readonly tGoSla = $localize`:@@fulfillment.overview.goSla:Edit SLA rules`;
    readonly tBoards = $localize`:@@fulfillment.overview.boards:Fulfillment boards`;
    readonly tOpenBoard = $localize`:@@fulfillment.overview.openBoard:Open board`;
    readonly tNoBoards = $localize`:@@fulfillment.overview.noBoards:No fulfillment boards yet.`;

    workspaceId = computed(() => this.route.parent?.snapshot.paramMap.get('workspaceId') || '');

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;

        try {
            const boards = await this.fulfillmentApi.ensureBoards(workspaceId);
            this.boards.set(boards);
            if (boards.length) {
                this.selectedBoardId.set(boards[0].id);
                await this.loadBoard(boards[0].id);
            }
        } finally {
            this.loading.set(false);
        }
    }

    async loadBoard(boardId: string) {
        if (!boardId) return;
        const [lists, rules] = await Promise.all([
            this.listsApi.fetchLists(boardId),
            this.fulfillmentApi.getSlaRules(boardId).catch(() => ({ rules: [] })),
        ]);
        const map: Record<string, number> = {};
        for (const r of rules.rules ?? []) map[r.listId] = r.slaHours;
        this.lists.set(lists);
        this.slaRules.set(map);
    }

    allCards(): Card[] {
        const all: Card[] = [];
        for (const l of this.lists()) {
            for (const c of l.cards ?? []) all.push({ ...c, listId: l.id });
        }
        return all.filter(c => !c.isArchived);
    }

    overdueCount(): number {
        const rules = this.slaRules();
        const now = Date.now();
        return this.allCards().filter(c => {
            const hours = rules[c.listId];
            if (!hours) return false;
            const statusKey = this.lists().find(l => l.id === c.listId)?.statusKey ?? null;
            if (statusKey === 'delivered' || statusKey === 'returned') return false;
            const changed = c.lastStatusChangedAt ? new Date(c.lastStatusChangedAt) : null;
            if (!changed || isNaN(changed.getTime())) return false;
            return changed.getTime() + hours * 3600000 < now;
        }).length;
    }

    shippedCount(): number {
        return this.allCards().filter(c => {
            const statusKey = this.lists().find(l => l.id === c.listId)?.statusKey ?? null;
            return statusKey === 'shipped';
        }).length;
    }

    deliveredCount(): number {
        return this.allCards().filter(c => {
            const statusKey = this.lists().find(l => l.id === c.listId)?.statusKey ?? null;
            return statusKey === 'delivered';
        }).length;
    }

    orderCount(): number {
        return this.allCards().filter(c => {
            const statusKey = this.lists().find(l => l.id === c.listId)?.statusKey ?? null;
            return statusKey !== 'delivered' && statusKey !== 'returned';
        }).length;
    }
}
