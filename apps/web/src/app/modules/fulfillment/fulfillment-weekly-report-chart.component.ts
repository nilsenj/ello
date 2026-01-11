import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

type DailyPoint = { date: string; count: number };

@Component({
    standalone: true,
    selector: 'fulfillment-weekly-report-chart',
    imports: [CommonModule],
    templateUrl: './fulfillment-weekly-report-chart.component.html',
})
export class FulfillmentWeeklyReportChartComponent implements OnChanges, AfterViewInit, OnDestroy {
    @Input() created: DailyPoint[] = [];
    @Input() shipped: DailyPoint[] = [];

    @ViewChild('chart') chartRef!: ElementRef<SVGSVGElement>;
    private viewReady = false;
    private isVisible = false;
    private pendingRender = false;
    private intersectionObserver?: IntersectionObserver;
    private resizeObserver?: ResizeObserver;

    readonly tCreated = $localize`:@@fulfillment.reports.created:Created`;
    readonly tShipped = $localize`:@@fulfillment.reports.shipped:Shipped`;

    ngOnChanges(changes: SimpleChanges) {
        if (changes['created'] || changes['shipped']) {
            if (this.viewReady && this.isVisible) {
                this.renderChart();
            } else {
                this.pendingRender = true;
            }
        }
    }

    ngAfterViewInit() {
        this.viewReady = true;
        this.setupObservers();
        if (this.isVisible) {
            this.renderChart();
        }
    }

    ngOnDestroy() {
        this.intersectionObserver?.disconnect();
        this.resizeObserver?.disconnect();
    }

    private setupObservers() {
        const el = this.chartRef?.nativeElement;
        if (!el) return;

        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver(entries => {
                const visible = entries.some(entry => entry.isIntersecting);
                this.isVisible = visible;
                if (visible && this.pendingRender) {
                    this.pendingRender = false;
                    this.renderChart();
                }
            }, { threshold: 0.1 });
            this.intersectionObserver.observe(el);
        } else {
            this.isVisible = true;
        }

        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver(() => {
                if (this.isVisible) {
                    this.renderChart();
                }
            });
            this.resizeObserver.observe(el);
        }
    }

    private renderChart() {
        if (!this.chartRef) return;
        const svg = d3.select(this.chartRef.nativeElement);
        const rect = this.chartRef.nativeElement.getBoundingClientRect();
        const width = Math.max(320, Math.floor(rect.width || 640));
        const height = width < 480 ? 180 : 220;
        const margin = { top: 20, right: 20, bottom: 30, left: 36 };

        svg.selectAll('*').remove();
        svg.attr('viewBox', `0 0 ${width} ${height}`);

        const dates = Array.from(new Set([
            ...this.created.map(d => d.date),
            ...this.shipped.map(d => d.date),
        ])).sort();

        if (!dates.length) {
            return;
        }

        const parseDate = d3.timeParse('%Y-%m-%d');
        const xDomain = dates.map(d => parseDate(d)!).filter(Boolean);
        const x = d3.scaleTime()
            .domain(d3.extent(xDomain) as [Date, Date])
            .range([margin.left, width - margin.right]);

        const maxValue = Math.max(
            d3.max(this.created, d => d.count) || 0,
            d3.max(this.shipped, d => d.count) || 0,
            1
        );
        const y = d3.scaleLinear()
            .domain([0, maxValue])
            .nice()
            .range([height - margin.bottom, margin.top]);

        const line = d3.line<DailyPoint>()
            .x(d => x(parseDate(d.date)!))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        const tickCount = width < 480 ? 4 : 6;

        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(tickCount).tickSizeOuter(0))
            .call(g => g.selectAll('text').attr('font-size', 10).attr('fill', '#64748b'));

        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(4))
            .call(g => g.selectAll('text').attr('font-size', 10).attr('fill', '#64748b'))
            .call(g => g.selectAll('line').attr('stroke', '#e2e8f0'))
            .call(g => g.selectAll('path').attr('stroke', '#e2e8f0'));

        svg.append('path')
            .datum(this.created)
            .attr('fill', 'none')
            .attr('stroke', '#475569')
            .attr('stroke-width', 2)
            .attr('d', line);

        svg.append('path')
            .datum(this.shipped)
            .attr('fill', 'none')
            .attr('stroke', '#2563eb')
            .attr('stroke-width', 2)
            .attr('d', line);

        const legend = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top - 10})`);

        legend.append('circle').attr('r', 4).attr('fill', '#475569').attr('cx', 4).attr('cy', 0);
        legend.append('text').text(this.tCreated).attr('x', 12).attr('y', 4).attr('font-size', 10).attr('fill', '#64748b');
        legend.append('circle').attr('r', 4).attr('fill', '#2563eb').attr('cx', 72).attr('cy', 0);
        legend.append('text').text(this.tShipped).attr('x', 80).attr('y', 4).attr('font-size', 10).attr('fill', '#64748b');
    }
}
