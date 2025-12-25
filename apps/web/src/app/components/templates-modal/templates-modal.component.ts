import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, XIcon, LayoutTemplateIcon, ChevronDownIcon } from 'lucide-angular';
import { TemplatesModalService } from './templates-modal.service';
import { WorkspacesService, WorkspaceLite } from '../../data/workspaces.service';
import { Router } from '@angular/router';

type Template = {
    id: string;
    name: string;
    description: string;
    lists: string[];
    background: string;
    category: 'core' | 'business';
    labels?: { name: string; color: string }[];
    cards?: {
        title: string;
        description?: string;
        list: string;
        checklists?: { title: string; items: string[] }[];
        labelNames?: string[];
    }[];
};

@Component({
    standalone: true,
    selector: 'templates-modal',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './templates-modal.component.html',
})
export class TemplatesModalComponent {
    readonly XIcon = XIcon;
    readonly LayoutTemplateIcon = LayoutTemplateIcon;
    readonly ChevronDownIcon = ChevronDownIcon;
    readonly tTitle = $localize`:@@templatesModal.title:Start with a Template`;
    readonly tChooseWorkspace = $localize`:@@templatesModal.chooseWorkspace:Choose Workspace`;
    readonly tCoreTemplates = $localize`:@@templatesModal.coreTemplates:Core Templates`;
    readonly tBusinessTemplates = $localize`:@@templatesModal.businessTemplates:Business Templates`;
    readonly tNameThisBoard = $localize`:@@templatesModal.nameThisBoard:Name this board`;
    readonly tCreateBoard = $localize`:@@templatesModal.createBoard:Create board`;
    readonly tBusinessBadge = $localize`:@@templatesModal.businessBadge:Business`;
    readonly tBusinessHint = $localize`:@@templatesModal.businessHint:Sales, operations, and support flows`;

    modal = inject(TemplatesModalService);
    workspacesApi = inject(WorkspacesService);
    router = inject(Router);

    workspaces = signal<WorkspaceLite[]>([]);
    selectedWorkspaceId = signal<string>('');
    creating = signal(false);
    showBusiness = signal(true);
    selectedTemplate = signal<Template | null>(null);
    boardNameDraft = signal<string>('');

    templates: Template[] = [
        {
            id: 'kanban',
            name: 'Kanban Board',
            description: 'A simple Kanban board with To Do, In Progress, and Done lists.',
            lists: ['To Do', 'In Progress', 'Done'],
            background: 'blue',
            category: 'core'
        },
        {
            id: 'scrum',
            name: 'Scrum Board',
            description: 'Manage your sprints with Backlog, Sprint Backlog, In Progress, Review, and Done.',
            lists: ['Backlog', 'Sprint Backlog', 'In Progress', 'Review', 'Done'],
            background: 'orange',
            category: 'core'
        },
        {
            id: 'roadmap',
            name: 'Product Roadmap',
            description: 'Plan your product roadmap with Q1, Q2, Q3, and Q4 lists.',
            lists: ['Q1', 'Q2', 'Q3', 'Q4'],
            background: 'green',
            category: 'core'
        },
        {
            id: 'brainstorming',
            name: 'Brainstorming',
            description: 'Collect ideas with Ideas, Voting, Approved, and Rejected lists.',
            lists: ['Ideas', 'Voting', 'Approved', 'Rejected'],
            background: 'purple',
            category: 'core'
        },
        {
            id: 'sales-pipeline',
            name: 'Sales Pipeline',
            description: 'Track inbound inquiries, quotes, and follow-ups from one view.',
            lists: ['Leads', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'],
            background: 'blue',
            category: 'business',
            labels: [
                { name: 'New lead', color: '#61BD4F' },
                { name: 'Follow-up', color: '#F2D600' },
                { name: 'High value', color: '#FF9F1A' },
                { name: 'Waiting', color: '#0079BF' },
                { name: 'Risk', color: '#EB5A46' }
            ],
            cards: [
                {
                    title: 'Acme Co inquiry',
                    description: 'Inbound form submission for a 3-month contract.',
                    list: 'Leads',
                    labelNames: ['New lead'],
                    checklists: [
                        { title: 'First contact', items: ['Log inquiry', 'Research account', 'Schedule intro call'] }
                    ]
                },
                {
                    title: 'Northwind proposal',
                    description: 'Draft proposal with pricing options.',
                    list: 'Proposal Sent',
                    labelNames: ['Follow-up', 'High value'],
                    checklists: [
                        { title: 'Proposal follow-up', items: ['Send proposal PDF', 'Follow up in 3 days', 'Capture decision'] }
                    ]
                }
            ]
        },
        {
            id: 'order-fulfillment',
            name: 'Order Fulfillment',
            description: 'Move orders from prep to packing to delivery with clear handoffs.',
            lists: ['New Order', 'Prep', 'Packing', 'Shipping', 'Delivered', 'Issue'],
            background: 'green',
            category: 'business',
            labels: [
                { name: 'Urgent', color: '#EB5A46' },
                { name: 'Awaiting Stock', color: '#F2D600' },
                { name: 'Picked', color: '#61BD4F' },
                { name: 'Packed', color: '#FF9F1A' },
                { name: 'Shipped', color: '#0079BF' }
            ],
            cards: [
                {
                    title: 'Order #1842 - Coffee beans',
                    description: 'Standard shipping, 2 bags.',
                    list: 'Prep',
                    labelNames: ['Picked'],
                    checklists: [
                        { title: 'Prep checklist', items: ['Confirm payment', 'Pick items', 'Print packing slip'] }
                    ]
                },
                {
                    title: 'Order #1847 - Espresso machine',
                    description: 'Fragile, signature required.',
                    list: 'Packing',
                    labelNames: ['Packed', 'Urgent'],
                    checklists: [
                        { title: 'Packing steps', items: ['Add foam padding', 'Seal box', 'Attach fragile label'] }
                    ]
                }
            ]
        },
        {
            id: 'daily-ops',
            name: 'Daily Ops',
            description: 'Open/close routines, inventory checks, and recurring tasks.',
            lists: ['Open', 'Morning', 'Midday', 'Afternoon', 'Close', 'Done'],
            background: 'orange',
            category: 'business',
            labels: [
                { name: 'Critical', color: '#EB5A46' },
                { name: 'Routine', color: '#61BD4F' },
                { name: 'Inventory', color: '#0079BF' },
                { name: 'Cleaning', color: '#C377E0' },
                { name: 'Admin', color: '#FF9F1A' }
            ],
            cards: [
                {
                    title: 'Open the shop',
                    description: 'Daily opening routine.',
                    list: 'Open',
                    labelNames: ['Routine'],
                    checklists: [
                        { title: 'Opening', items: ['Unlock doors', 'Power on systems', 'Check register float'] }
                    ]
                },
                {
                    title: 'Inventory spot check',
                    description: 'Top 10 items restock check.',
                    list: 'Midday',
                    labelNames: ['Inventory'],
                    checklists: [
                        { title: 'Stock check', items: ['Count top sellers', 'Record low stock', 'Place refill request'] }
                    ]
                }
            ]
        },
        {
            id: 'support',
            name: 'Support',
            description: 'Log tickets, triage fixes, and keep customers in the loop.',
            lists: ['New', 'Triage', 'In Progress', 'Waiting on Customer', 'Resolved'],
            background: 'red',
            category: 'business',
            labels: [
                { name: 'Bug', color: '#EB5A46' },
                { name: 'Billing', color: '#FF9F1A' },
                { name: 'Feature Request', color: '#61BD4F' },
                { name: 'Urgent', color: '#C377E0' },
                { name: 'Question', color: '#0079BF' }
            ],
            cards: [
                {
                    title: 'Login issue: password reset',
                    description: 'Customer cannot reset password from email link.',
                    list: 'New',
                    labelNames: ['Bug', 'Urgent'],
                    checklists: [
                        { title: 'Triage', items: ['Confirm account email', 'Check reset logs', 'Reply with next steps'] }
                    ]
                },
                {
                    title: 'Refund request',
                    description: 'Order #1762 refund within policy.',
                    list: 'Triage',
                    labelNames: ['Billing'],
                    checklists: [
                        { title: 'Resolution', items: ['Verify order', 'Confirm policy', 'Process refund'] }
                    ]
                }
            ]
        }
    ];

    coreTemplates() {
        return this.templates.filter(t => t.category === 'core');
    }

    businessTemplates() {
        return this.templates.filter(t => t.category === 'business');
    }

    constructor() {
        // Load workspaces when component initializes (or when modal opens if we used effect)
        this.loadWorkspaces();
    }

    async loadWorkspaces() {
        try {
            const list = await this.workspacesApi.list();
            this.workspaces.set(list);
            if (list.length > 0) {
                this.selectedWorkspaceId.set(list[0].id);
            }
        } catch (err) {
            console.error('Failed to load workspaces', err);
        }
    }

    close() {
        this.modal.close();
    }

    onBackdrop(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            this.close();
        }
    }

    selectWorkspace(event: Event) {
        const target = event.target as HTMLSelectElement;
        this.selectedWorkspaceId.set(target.value);
    }

    toggleBusiness() {
        this.showBusiness.update(v => !v);
    }

    selectTemplate(template: Template) {
        this.selectedTemplate.set(template);
        this.boardNameDraft.set(template.name);
    }

    async createFromSelected() {
        const template = this.selectedTemplate();
        if (!template || !this.selectedWorkspaceId() || this.creating()) return;

        this.creating.set(true);
        try {
            // Get unique board name by checking existing boards in workspace
            const desiredName = this.boardNameDraft().trim() || template.name;
            const boardName = await this.getUniqueBoardName(desiredName, this.selectedWorkspaceId());

            // 1. Create Board with template lists and background
            const board = await this.workspacesApi.createBoard(this.selectedWorkspaceId(), {
                name: boardName,
                description: template.description,
                background: template.background,
                lists: template.lists,
                labels: template.labels,
                cards: template.cards
            });

            this.close();
            this.router.navigate(['/b', board.id]);
        } catch (err) {
            console.error('Failed to create board from template', err);
        } finally {
            this.creating.set(false);
        }
    }

    private async getUniqueBoardName(baseName: string, workspaceId: string): Promise<string> {
        try {
            // Get all boards to check for name conflicts
            const existingBoards = await this.workspacesApi.getBoardsInWorkspace(workspaceId);
            const existingNames = new Set(existingBoards.map((b: any) => b.name.toLowerCase()));

            // If base name doesn't exist, use it
            if (!existingNames.has(baseName.toLowerCase())) {
                return baseName;
            }

            // Otherwise, find the next available number
            let counter = 2;
            let newName = `${baseName} (${counter})`;
            while (existingNames.has(newName.toLowerCase())) {
                counter++;
                newName = `${baseName} (${counter})`;
            }

            return newName;
        } catch (err) {
            console.error('Failed to check existing boards, using base name', err);
            return baseName;
        }
    }
}
