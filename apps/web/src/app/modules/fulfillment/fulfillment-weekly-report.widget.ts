import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FulfillmentWeeklyReportChartComponent } from './fulfillment-weekly-report-chart.component';

@Component({
    standalone: true,
    selector: 'fulfillment-weekly-report-widget',
    imports: [CommonModule, FulfillmentWeeklyReportChartComponent],
    templateUrl: './fulfillment-weekly-report.widget.html',
})
export class FulfillmentWeeklyReportWidgetComponent {
    @Input() report: {
        created: number;
        shipped: number;
        delivered: number;
        returned: number;
        overdue: number;
        backlog: number;
        avgFulfillmentHours: number | null;
        daily: {
            created: Array<{ date: string; count: number }>;
            shipped: Array<{ date: string; count: number }>;
        };
    } | null = null;
    @Input() loading = false;

    readonly tCreated = $localize`:@@fulfillment.reports.created:Created`;
    readonly tShipped = $localize`:@@fulfillment.reports.shipped:Shipped`;
    readonly tDelivered = $localize`:@@fulfillment.reports.delivered:Delivered`;
    readonly tReturned = $localize`:@@fulfillment.reports.returned:Returned`;
    readonly tOverdue = $localize`:@@fulfillment.reports.overdue:Overdue`;
    readonly tBacklog = $localize`:@@fulfillment.reports.backlog:Backlog`;
    readonly tAvgFulfillment = $localize`:@@fulfillment.reports.avgFulfillment:Avg fulfillment (hrs)`;
    readonly tEmpty = $localize`:@@fulfillment.reports.empty:Run the report to see weekly stats.`;
    readonly tLoading = $localize`:@@fulfillment.reports.loading:Loading report…`;

    barWidth(value: number) {
        if (!this.report) return '0%';
        const max = Math.max(
            this.report.created,
            this.report.shipped,
            this.report.delivered,
            this.report.returned,
            this.report.overdue,
            1
        );
        return `${Math.round((value / max) * 100)}%`;
    }
}
