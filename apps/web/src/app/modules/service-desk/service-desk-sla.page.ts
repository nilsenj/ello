import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ServiceDeskService, ServiceDeskBoardLite } from '../../data/service-desk.service';
import { ListsService } from '../../data/lists.service';
import type { ListDto } from '../../types';

@Component({
    standalone: true,
    selector: 'service-desk-sla-page',
    imports: [CommonModule, FormsModule],
    templateUrl: './service-desk-sla.page.html',
})
export class ServiceDeskSlaPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private serviceDeskApi = inject(ServiceDeskService);
    private listsApi = inject(ListsService);

    boards = signal<ServiceDeskBoardLite[]>([]);
    selectedBoardId = signal('');
    lists = signal<ListDto[]>([]);
    rules = signal<Record<string, number>>({});
    saving = signal(false);
    statusMap = signal<Record<string, string>>({});
    mappingSaving = signal(false);
    whyOpen = signal(false);

    readonly tTitle = $localize`:@@serviceDesk.sla.title:SLA rules`;
    readonly tBoardLabel = $localize`:@@serviceDesk.boardLabel:Board`;
    readonly tSlaHours = $localize`:@@serviceDesk.slaHours:SLA hours`;
    readonly tSave = $localize`:@@serviceDesk.save:Save`;
    readonly tStatusMappingTitle = $localize`:@@serviceDesk.statusMapping.title:Status mapping`;
    readonly tStatusMappingHint = $localize`:@@serviceDesk.statusMapping.hint:Map custom lists to a Service Desk status so SLA and alerts work correctly.`;
    readonly tStatusMappingHelper = $localize`:@@serviceDesk.statusMapping.helper:Unmapped lists are excluded from SLA timers and notifications.`;
    readonly tStatusMappingWhy = $localize`:@@serviceDesk.statusMapping.why:Why this matters`;
    readonly tStatusMappingWhyTooltip = $localize`:@@serviceDesk.statusMapping.whyTooltip:SLA and alerts rely on status keys to know when requests start, pause, and finish.`;
    readonly tStatusMappingSave = $localize`:@@serviceDesk.statusMapping.save:Save mapping`;
    readonly tStatusMappingEmpty = $localize`:@@serviceDesk.statusMapping.empty:No custom lists to map.`;
    readonly tStatusMappingRequired = $localize`:@@serviceDesk.statusMapping.required:Status required`;
    readonly tStatusLabel = $localize`:@@serviceDesk.statusMapping.status:Status`;
    readonly tSelectStatus = $localize`:@@serviceDesk.statusMapping.select:Select status`;
    readonly tStatusInbox = $localize`:@@serviceDesk.statusInbox:Inbox`;
    readonly tStatusScheduled = $localize`:@@serviceDesk.statusScheduled:Scheduled`;
    readonly tStatusInProgress = $localize`:@@serviceDesk.statusInProgress:In Progress`;
    readonly tStatusWaitingClient = $localize`:@@serviceDesk.statusWaitingClient:Waiting Client`;
    readonly tStatusDone = $localize`:@@serviceDesk.statusDone:Done`;
    readonly tStatusCanceled = $localize`:@@serviceDesk.statusCanceled:Canceled`;

    readonly statusOptions = [
        { key: 'inbox', label: this.tStatusInbox },
        { key: 'scheduled', label: this.tStatusScheduled },
        { key: 'in_progress', label: this.tStatusInProgress },
        { key: 'waiting_client', label: this.tStatusWaitingClient },
        { key: 'done', label: this.tStatusDone },
        { key: 'canceled', label: this.tStatusCanceled },
    ] as const;

    workspaceId = computed(() => this.route.parent?.snapshot.paramMap.get('workspaceId') || '');

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;
        const boards = await this.serviceDeskApi.ensureBoards(workspaceId);
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
            this.serviceDeskApi.getSlaRules(boardId).catch(() => ({ rules: [] })),
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
            await this.serviceDeskApi.updateSlaRules(boardId, rules);
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
