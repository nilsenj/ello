import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ServiceDeskService, ServiceDeskBoardLite } from '../../data/service-desk.service';
import { ServiceDeskWeeklyReportWidgetComponent } from './service-desk-weekly-report.widget';
import { ClickOutsideDirective } from '../../ui/click-outside.directive';
import { FlatpickrDirective } from '../../ui/flatpickr.directive';

@Component({
    standalone: true,
    selector: 'service-desk-reports-page',
    imports: [
        CommonModule,
        FormsModule,
        ServiceDeskWeeklyReportWidgetComponent,
        ClickOutsideDirective,
        FlatpickrDirective,
    ],
    templateUrl: './service-desk-reports.page.html',
})
export class ServiceDeskReportsPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private serviceDeskApi = inject(ServiceDeskService);

    boards = signal<ServiceDeskBoardLite[]>([]);
    selectedBoardId = signal('');
    boardMenuOpen = signal(false);
    boardQuery = signal('');
    from = signal('');
    to = signal('');
    loading = signal(false);
    rangePreset = signal<'this' | null>(null);
    report = signal<{
        created: number;
        closed: number;
        overdue: number;
        backlog: number;
        avgResolutionHours: number | null;
        daily: {
            created: Array<{ date: string; count: number }>;
            closed: Array<{ date: string; count: number }>;
        };
    } | null>(null);
    readonly tTitle = $localize`:@@serviceDesk.reports.title:Weekly report`;
    readonly tBoardLabel = $localize`:@@serviceDesk.boardLabel:Board`;
    readonly tFrom = $localize`:@@serviceDesk.reports.from:From`;
    readonly tTo = $localize`:@@serviceDesk.reports.to:To`;
    readonly tRun = $localize`:@@serviceDesk.reports.run:Run report`;
    readonly tCreated = $localize`:@@serviceDesk.reports.created:Created`;
    readonly tClosed = $localize`:@@serviceDesk.reports.closed:Closed`;
    readonly tOverdue = $localize`:@@serviceDesk.reports.overdue:Overdue`;
    readonly tThisWeek = $localize`:@@serviceDesk.reports.thisWeek:This week`;
    readonly tLastWeek = $localize`:@@serviceDesk.reports.lastWeek:Last week`;
    readonly tBoardSelect = $localize`:@@serviceDesk.reports.boardSelect:Select board`;
    readonly tBoardSearch = $localize`:@@serviceDesk.reports.boardSearch:Search boards`;
    readonly tNoBoards = $localize`:@@serviceDesk.reports.noBoards:No boards found`;

    workspaceId = computed(() => this.route.parent?.snapshot.paramMap.get('workspaceId') || '');
    selectedBoardName = computed(() => {
        const id = this.selectedBoardId();
        const board = this.boards().find(b => b.id === id);
        return board?.name || this.tBoardSelect;
    });
    filteredBoards = computed(() => {
        const q = this.boardQuery().trim().toLowerCase();
        const boards = this.boards();
        if (!q) return boards;
        return boards.filter(b => b.name.toLowerCase().includes(q));
    });

    async ngOnInit() {
        const workspaceId = this.workspaceId();
        if (!workspaceId) return;
        const boards = await this.serviceDeskApi.listBoards(workspaceId);
        this.boards.set(boards);
        if (boards.length) {
            this.selectedBoardId.set(boards[0].id);
        }
        this.setThisWeek();
        if (this.selectedBoardId()) {
            await this.runReport();
        }
    }

    async runReport() {
        const boardId = this.selectedBoardId();
        if (!boardId || !this.from() || !this.to()) return;
        this.loading.set(true);
        try {
            const res = await this.serviceDeskApi.getWeeklyReport(boardId, this.from(), this.to());
            this.report.set(res);
        } finally {
            this.loading.set(false);
        }
    }

    onBoardChange(boardId: string) {
        this.selectedBoardId.set(boardId);
        this.runReport();
    }

    toggleBoardMenu() {
        this.boardMenuOpen.update(v => !v);
    }

    closeBoardMenu() {
        this.boardMenuOpen.set(false);
    }

    selectBoard(boardId: string) {
        this.onBoardChange(boardId);
        this.boardMenuOpen.set(false);
        this.boardQuery.set('');
    }

    onFromChange(value: string) {
        this.from.set(value);
        this.rangePreset.set(null);
        this.runReport();
    }

    onToChange(value: string) {
        this.to.set(value);
        this.rangePreset.set(null);
        this.runReport();
    }

    setThisWeek() {
        const { start, end } = this.getWeekRange(new Date());
        this.from.set(start);
        this.to.set(end);
        this.rangePreset.set('this');
    }

    // last week preset removed for now

    private getWeekRange(date: Date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = (d.getDay() + 6) % 7; // Monday = 0
        const start = new Date(d);
        start.setDate(d.getDate() - day);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { start: this.formatLocalDate(start), end: this.formatLocalDate(end) };
    }

    private formatLocalDate(date: Date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

}
