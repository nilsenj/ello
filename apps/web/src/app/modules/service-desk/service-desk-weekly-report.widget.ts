import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceDeskWeeklyReportChartComponent } from './service-desk-weekly-report-chart.component';

@Component({
    standalone: true,
    selector: 'service-desk-weekly-report-widget',
    imports: [CommonModule, ServiceDeskWeeklyReportChartComponent],
    templateUrl: './service-desk-weekly-report.widget.html',
})
export class ServiceDeskWeeklyReportWidgetComponent {
    @Input() report: {
        created: number;
        closed: number;
        overdue: number;
        backlog: number;
        avgResolutionHours: number | null;
        daily: {
            created: Array<{ date: string; count: number }>;
            closed: Array<{ date: string; count: number }>;
        };
    } | null = null;
    @Input() loading = false;

    readonly tCreated = $localize`:@@serviceDesk.reports.created:Created`;
    readonly tClosed = $localize`:@@serviceDesk.reports.closed:Closed`;
    readonly tOverdue = $localize`:@@serviceDesk.reports.overdue:Overdue`;
    readonly tBacklog = $localize`:@@serviceDesk.reports.backlog:Backlog`;
    readonly tAvgResolution = $localize`:@@serviceDesk.reports.avgResolution:Avg resolution (hrs)`;
    readonly tEmpty = $localize`:@@serviceDesk.reports.empty:Run the report to see weekly stats.`;
    readonly tLoading = $localize`:@@serviceDesk.reports.loading:Loading report…`;

    barWidth(value: number) {
        if (!this.report) return '0%';
        const max = Math.max(this.report.created, this.report.closed, this.report.overdue, 1);
        return `${Math.round((value / max) * 100)}%`;
    }
}
