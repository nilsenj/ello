import { Component, ElementRef, ViewChild, OnInit, OnDestroy, inject, signal, computed, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, ArrowLeft, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-angular';
import * as d3 from 'd3';
import { BoardStore } from '../../store/board-store.service';
import { BoardsService } from '../../data/boards.service';
import { CardsService } from '../../data/cards.service';
import { UserHeaderComponent } from '../user-header/user-header.component';

interface DiagramNode extends d3.SimulationNodeDatum {
    id: string;
    title: string;
    listId: string;
    listName: string;
    priority: string;
    labels: string[];
}

interface DiagramLink extends d3.SimulationLinkDatum<DiagramNode> {
    id: string;
    type: 'blocks' | 'depends_on' | 'relates_to' | 'duplicates';
}

@Component({
    standalone: true,
    selector: 'board-diagram',
    imports: [CommonModule, RouterModule, FormsModule, LucideAngularModule, UserHeaderComponent],
    templateUrl: './board-diagram.component.html',
    styleUrls: ['./board-diagram.component.css']
})
export class BoardDiagramComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<SVGSVGElement>;

    // Icons
    readonly ArrowLeftIcon = ArrowLeft;
    readonly ZoomInIcon = ZoomIn;
    readonly ZoomOutIcon = ZoomOut;
    readonly ResetIcon = RotateCcw;
    readonly FullscreenIcon = Maximize2;

    // Services
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private store = inject(BoardStore);
    private boardsApi = inject(BoardsService);
    private cardsApi = inject(CardsService);

    // State
    boardId = signal<string>('');
    loading = signal<boolean>(true);
    nodes = signal<DiagramNode[]>([]);
    links = signal<DiagramLink[]>([]);
    selectedListId = signal<string>('all');

    // Computed
    board = computed(() => this.store.boards().find(b => b.id === this.boardId()));
    lists = computed(() => this.store.lists());
    filteredNodes = computed(() => {
        const listId = this.selectedListId();
        if (listId === 'all') return this.nodes();
        return this.nodes().filter(n => n.listId === listId);
    });

    // D3 references
    private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private simulation!: d3.Simulation<DiagramNode, DiagramLink>;
    private zoom!: d3.ZoomBehavior<SVGSVGElement, unknown>;
    private container!: d3.Selection<SVGGElement, unknown, null, undefined>;

    // List color mapping
    private listColors: Record<string, string> = {};
    private colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    async ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.boardId.set(id);
            await this.loadData();
        }
    }

    ngAfterViewInit() {
        this.initializeSvg();
    }

    ngOnDestroy() {
        if (this.simulation) {
            this.simulation.stop();
        }
    }

    private async loadData() {
        try {
            // Load board data
            await this.boardsApi.selectBoard(this.boardId());

            // Build nodes from cards (cards are nested within lists)
            const lists = this.store.lists();
            const allCards: { id: string; title: string; listId: string; priority?: string; labelIds?: string[]; isArchived?: boolean }[] = [];

            lists.forEach(list => {
                (list.cards ?? []).forEach((card: any) => {
                    allCards.push({
                        id: card.id,
                        title: card.title,
                        listId: list.id,
                        priority: card.priority,
                        labelIds: card.labelIds,
                        isArchived: card.isArchived
                    });
                });
            });

            // Assign colors to lists
            lists.forEach((list, i) => {
                this.listColors[list.id] = this.colorScale(i.toString());
            });

            const diagramNodes: DiagramNode[] = allCards
                .filter(c => !c.isArchived)
                .map(card => {
                    const list = lists.find(l => l.id === card.listId);
                    return {
                        id: card.id,
                        title: card.title,
                        listId: card.listId,
                        listName: list?.name || 'Unknown',
                        priority: card.priority || 'medium',
                        labels: card.labelIds || []
                    };
                });

            this.nodes.set(diagramNodes);

            // Load relations for all cards (limit for performance)
            const allLinks: DiagramLink[] = [];
            for (const card of allCards.slice(0, 50)) {
                try {
                    const relations = await this.cardsApi.getCardRelations(card.id);
                    relations.outgoing.forEach((r) => {
                        allLinks.push({
                            id: r.id,
                            source: card.id,
                            target: r.card.id,
                            type: r.type as DiagramLink['type']
                        });
                    });
                } catch { /* ignore */ }
            }

            this.links.set(allLinks);
            this.loading.set(false);

            // Render after data loaded
            setTimeout(() => this.renderDiagram(), 100);
        } catch (err) {
            console.error('Failed to load diagram data', err);
            this.loading.set(false);
        }
    }

    private initializeSvg() {
        const svg = d3.select(this.canvasRef.nativeElement);
        this.svg = svg;

        // Get dimensions
        const width = this.canvasRef.nativeElement.clientWidth || 800;
        const height = this.canvasRef.nativeElement.clientHeight || 600;

        // Setup zoom
        this.zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.container.attr('transform', event.transform);
            });

        svg.call(this.zoom);

        // Create container for zoom/pan
        this.container = svg.append('g').attr('class', 'diagram-container');

        // Add arrow markers for edges
        const defs = svg.append('defs');

        ['blocks', 'depends_on', 'relates_to', 'duplicates'].forEach(type => {
            defs.append('marker')
                .attr('id', `arrow-${type}`)
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 25)
                .attr('refY', 0)
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto')
                .append('path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('fill', this.getLinkColor(type as any));
        });
    }

    private renderDiagram() {
        if (!this.container) return;

        const nodes = this.filteredNodes();
        const links = this.links().filter(l => {
            const sourceId = typeof l.source === 'string' ? l.source : (l.source as DiagramNode).id;
            const targetId = typeof l.target === 'string' ? l.target : (l.target as DiagramNode).id;
            return nodes.some(n => n.id === sourceId) && nodes.some(n => n.id === targetId);
        });

        // Clear previous
        this.container.selectAll('*').remove();

        if (nodes.length === 0) return;

        const width = this.canvasRef.nativeElement.clientWidth || 800;
        const height = this.canvasRef.nativeElement.clientHeight || 600;

        // Create simulation
        this.simulation = d3.forceSimulation<DiagramNode>(nodes)
            .force('link', d3.forceLink<DiagramNode, DiagramLink>(links)
                .id(d => d.id)
                .distance(120))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(50));

        // Draw links
        const link = this.container.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke', d => this.getLinkColor(d.type))
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', d => d.type === 'relates_to' ? '5,5' : null)
            .attr('marker-end', d => `url(#arrow-${d.type})`);

        // Draw nodes
        const node = this.container.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .call(d3.drag<SVGGElement, DiagramNode>()
                .on('start', (event, d) => this.dragStarted(event, d))
                .on('drag', (event, node) => {
                    node.x += event.dx;
                    node.y += event.dy;
                    d3.select(event.sourceEvent.target).attr("transform", `translate(${node.x},${node.y})`);
                    this.dragged(event, node);
                })
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragEnded(event, d)));

        // Node background
        node.append('rect')
            .attr('width', 140)
            .attr('height', 50)
            .attr('rx', 8)
            .attr('ry', 8)
            .attr('x', -70)
            .attr('y', -25)
            .attr('fill', d => this.listColors[d.listId] || '#6366f1')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('cursor', 'pointer')
            .on('click', (event, d) => this.onNodeClick(d));

        // Node title
        node.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', '#fff')
            .attr('font-size', '12px')
            .attr('font-weight', '500')
            .attr('pointer-events', 'none')
            .text(d => d.title.length > 18 ? d.title.slice(0, 16) + '...' : d.title);

        // Priority indicator
        node.append('circle')
            .attr('cx', 60)
            .attr('cy', -15)
            .attr('r', 6)
            .attr('fill', d => this.getPriorityColor(d.priority));

        // Simulation tick
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => (d.source as DiagramNode).x!)
                .attr('y1', d => (d.source as DiagramNode).y!)
                .attr('x2', d => (d.target as DiagramNode).x!)
                .attr('y2', d => (d.target as DiagramNode).y!);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });
    }

    private getLinkColor(type: string): string {
        const colors: Record<string, string> = {
            'blocks': '#ef4444',      // red
            'depends_on': '#f59e0b',   // amber
            'relates_to': '#6b7280',   // gray
            'duplicates': '#8b5cf6'    // purple
        };
        return colors[type] || '#6b7280';
    }

    private getPriorityColor(priority: string): string {
        const colors: Record<string, string> = {
            'urgent': '#dc2626',
            'high': '#f59e0b',
            'medium': '#3b82f6',
            'low': '#22c55e'
        };
        return colors[priority] || '#3b82f6';
    }

    private dragStarted(event: d3.D3DragEvent<SVGGElement, DiagramNode, DiagramNode>, d: DiagramNode) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    private dragged(event: d3.D3DragEvent<SVGGElement, DiagramNode, DiagramNode>, d: DiagramNode) {
        d.fx = event.x;
        d.fy = event.y;
    }

    private dragEnded(event: d3.D3DragEvent<SVGGElement, DiagramNode, DiagramNode>, d: DiagramNode) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    onNodeClick(node: DiagramNode) {
        // Navigate to card modal or open sidebar
        this.router.navigate(['/b', this.boardId()], { queryParams: { card: node.id } });
    }

    goBack() {
        this.router.navigate(['/b', this.boardId()]);
    }

    resetZoom() {
        this.svg.transition().duration(500).call(
            this.zoom.transform,
            d3.zoomIdentity
        );
    }

    zoomIn() {
        this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.3);
    }

    zoomOut() {
        this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.7);
    }

    onListFilterChange() {
        this.renderDiagram();
    }
}
