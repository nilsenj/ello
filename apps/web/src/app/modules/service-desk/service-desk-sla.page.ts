import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

    readonly tTitle = $localize`:@@serviceDesk.sla.title:SLA rules`;
    readonly tBoardLabel = $localize`:@@serviceDesk.boardLabel:Board`;
    readonly tSlaHours = $localize`:@@serviceDesk.slaHours:SLA hours`;
    readonly tSave = $localize`:@@serviceDesk.save:Save`;

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
        this.lists.set(lists);
        this.rules.set(map);
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
}
