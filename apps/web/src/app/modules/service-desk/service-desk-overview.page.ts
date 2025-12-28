import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ServiceDeskService, ServiceDeskBoardLite } from '../../data/service-desk.service';
import { ListsService } from '../../data/lists.service';
import type { Card, ListDto } from '../../types';

@Component({
    standalone: true,
    selector: 'service-desk-overview-page',
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './service-desk-overview.page.html',
})
export class ServiceDeskOverviewPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private serviceDeskApi = inject(ServiceDeskService);
    private listsApi = inject(ListsService);

    boards = signal<ServiceDeskBoardLite[]>([]);
    selectedBoardId = signal('');
    lists = signal<ListDto[]>([]);
    slaRules = signal<Record<string, number>>({});

    loading = signal(true);

    readonly tOverview = $localize`:@@serviceDesk.overview.title:Module overview`;
    readonly tRequests = $localize`:@@serviceDesk.overview.requests:Requests`;
    readonly tOverdue = $localize`:@@serviceDesk.overview.overdue:Overdue`;
    readonly tDone = $localize`:@@serviceDesk.overview.done:Done`;
    readonly tBoardLabel = $localize`:@@serviceDesk.boardLabel:Board`;
    readonly tOpenRequests = $localize`:@@serviceDesk.overview.openRequests:Open requests`;
    readonly tQuickLinks = $localize`:@@serviceDesk.overview.quickLinks:Quick actions`;
    readonly tGoRequests = $localize`:@@serviceDesk.overview.goRequests:View requests`;
    readonly tGoSla = $localize`:@@serviceDesk.overview.goSla:Edit SLA rules`;
    readonly tBoards = $localize`:@@serviceDesk.overview.boards:Service Desk boards`;
    readonly tOpenBoard = $localize`:@@serviceDesk.overview.openBoard:Open board`;
    readonly tNoBoards = $localize`:@@serviceDesk.overview.noBoards:No Service Desk boards yet.`;

    workspaceId = computed(() => this.route.parent?.snapshot.paramMap.get('workspaceId') || '');

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;

        try {
            const boards = await this.serviceDeskApi.ensureBoards(workspaceId);
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
            this.serviceDeskApi.getSlaRules(boardId).catch(() => ({ rules: [] })),
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
            const listName = this.lists().find(l => l.id === c.listId)?.name ?? '';
            if (listName === 'Done' || listName === 'Canceled') return false;
            const changed = c.lastStatusChangedAt ? new Date(c.lastStatusChangedAt) : null;
            if (!changed || isNaN(changed.getTime())) return false;
            return changed.getTime() + hours * 3600000 < now;
        }).length;
    }

    doneCount(): number {
        return this.allCards().filter(c => {
            const listName = this.lists().find(l => l.id === c.listId)?.name ?? '';
            return listName === 'Done';
        }).length;
    }

    requestCount(): number {
        return this.allCards().filter(c => {
            const listName = this.lists().find(l => l.id === c.listId)?.name ?? '';
            return listName !== 'Done' && listName !== 'Canceled';
        }).length;
    }
}
