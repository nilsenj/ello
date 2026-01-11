import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FulfillmentService, FulfillmentBoardLite } from '../../data/fulfillment.service';
import { ListsService } from '../../data/lists.service';
import type { ListDto } from '../../types';

@Component({
    standalone: true,
    selector: 'fulfillment-sla-page',
    imports: [CommonModule, FormsModule],
    templateUrl: './fulfillment-sla.page.html',
})
export class FulfillmentSlaPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private fulfillmentApi = inject(FulfillmentService);
    private listsApi = inject(ListsService);

    boards = signal<FulfillmentBoardLite[]>([]);
    selectedBoardId = signal('');
    lists = signal<ListDto[]>([]);
    rules = signal<Record<string, number>>({});
    saving = signal(false);
    statusMap = signal<Record<string, string>>({});
    mappingSaving = signal(false);
    whyOpen = signal(false);

    readonly tTitle = $localize`:@@fulfillment.sla.title:SLA rules`;
    readonly tBoardLabel = $localize`:@@fulfillment.boardLabel:Board`;
    readonly tSlaHours = $localize`:@@fulfillment.slaHours:SLA hours`;
    readonly tSave = $localize`:@@fulfillment.save:Save`;
    readonly tStatusMappingTitle = $localize`:@@fulfillment.statusMapping.title:Status mapping`;
    readonly tStatusMappingHint = $localize`:@@fulfillment.statusMapping.hint:Map custom lists to a fulfillment status so SLA and alerts work correctly.`;
    readonly tStatusMappingHelper = $localize`:@@fulfillment.statusMapping.helper:Unmapped lists are excluded from SLA timers and notifications.`;
    readonly tStatusMappingWhy = $localize`:@@fulfillment.statusMapping.why:Why this matters`;
    readonly tStatusMappingWhyTooltip = $localize`:@@fulfillment.statusMapping.whyTooltip:SLA and alerts rely on status keys to know when orders move through your workflow.`;
    readonly tStatusMappingSave = $localize`:@@fulfillment.statusMapping.save:Save mapping`;
    readonly tStatusMappingEmpty = $localize`:@@fulfillment.statusMapping.empty:No custom lists to map.`;
    readonly tStatusMappingRequired = $localize`:@@fulfillment.statusMapping.required:Status required`;
    readonly tStatusLabel = $localize`:@@fulfillment.statusMapping.status:Status`;
    readonly tSelectStatus = $localize`:@@fulfillment.statusMapping.select:Select status`;
    readonly tStatusOrder = $localize`:@@fulfillment.statusOrder:Order`;
    readonly tStatusPacking = $localize`:@@fulfillment.statusPacking:Packing`;
    readonly tStatusShipped = $localize`:@@fulfillment.statusShipped:Shipped`;
    readonly tStatusDelivered = $localize`:@@fulfillment.statusDelivered:Delivered`;
    readonly tStatusReturned = $localize`:@@fulfillment.statusReturned:Returned`;

    readonly statusOptions = [
        { key: 'order', label: this.tStatusOrder },
        { key: 'packing', label: this.tStatusPacking },
        { key: 'shipped', label: this.tStatusShipped },
        { key: 'delivered', label: this.tStatusDelivered },
        { key: 'returned', label: this.tStatusReturned },
    ] as const;

    workspaceId = computed(() => this.route.parent?.snapshot.paramMap.get('workspaceId') || '');

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;
        const boards = await this.fulfillmentApi.ensureBoards(workspaceId);
        this.boards.set(boards);
        if (boards.length) {
            this.selectedBoardId.set(boards[0].id);
            await this.loadBoard(boards[0].id);
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
        const statusMap: Record<string, string> = {};
        for (const l of lists) statusMap[l.id] = l.statusKey ?? '';
        this.lists.set(lists);
        this.rules.set(map);
        this.statusMap.set(statusMap);
    }

    setRule(listId: string, value: number | string) {
        const num = typeof value === 'number' ? value : Number(value);
        const next = { ...this.rules() };
        if (!Number.isFinite(num) || num <= 0) {
            delete next[listId];
        } else {
            next[listId] = num;
        }
        this.rules.set(next);
    }

    async save() {
        const boardId = this.selectedBoardId();
        if (!boardId || this.saving()) return;
        this.saving.set(true);
        try {
            const map = this.rules();
            const rules = Object.entries(map)
                .filter(([, hours]) => Number.isFinite(hours) && hours > 0)
                .map(([listId, slaHours]) => ({ listId, slaHours: Number(slaHours) }));
            await this.fulfillmentApi.updateSlaRules(boardId, rules);
        } finally {
            this.saving.set(false);
        }
    }

    customLists = computed(() => this.lists().filter(l => !l.isSystem));

    hasUnmappedCustomLists = computed(() =>
        this.customLists().some(l => !(this.statusMap()[l.id] || '').trim())
    );

    setStatus(listId: string, statusKey: string) {
        const next = { ...this.statusMap() };
        next[listId] = statusKey;
        this.statusMap.set(next);
    }

    async saveStatusMapping() {
        const boardId = this.selectedBoardId();
        if (!boardId || this.mappingSaving()) return;
        if (this.hasUnmappedCustomLists()) return;
        const lists = this.customLists();
        if (!lists.length) return;
        this.mappingSaving.set(true);
        try {
            const updates = lists
                .filter(l => (this.statusMap()[l.id] || '') !== (l.statusKey || ''))
                .map(l => this.listsApi.updateList(l.id, { statusKey: this.statusMap()[l.id] }));
            if (updates.length) {
                await Promise.all(updates);
            }
            await this.loadBoard(boardId);
        } finally {
            this.mappingSaving.set(false);
        }
    }

    toggleWhy(event: MouseEvent) {
        event.stopPropagation();
        this.whyOpen.set(!this.whyOpen());
    }

    @HostListener('document:click')
    closeWhy() {
        if (this.whyOpen()) this.whyOpen.set(false);
    }
}
