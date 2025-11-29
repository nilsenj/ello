import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, XIcon, LayoutTemplateIcon } from 'lucide-angular';
import { TemplatesModalService } from './templates-modal.service';
import { WorkspacesService, WorkspaceLite } from '../../data/workspaces.service';
import { Router } from '@angular/router';

type Template = {
    id: string;
    name: string;
    description: string;
    lists: string[];
    background: string;
};

@Component({
    standalone: true,
    selector: 'templates-modal',
    imports: [CommonModule, LucideAngularModule],
    templateUrl: './templates-modal.component.html',
})
export class TemplatesModalComponent {
    readonly XIcon = XIcon;
    readonly LayoutTemplateIcon = LayoutTemplateIcon;

    modal = inject(TemplatesModalService);
    workspacesApi = inject(WorkspacesService);
    router = inject(Router);

    workspaces = signal<WorkspaceLite[]>([]);
    selectedWorkspaceId = signal<string>('');
    creating = signal(false);

    templates: Template[] = [
        {
            id: 'kanban',
            name: 'Kanban Board',
            description: 'A simple Kanban board with To Do, In Progress, and Done lists.',
            lists: ['To Do', 'In Progress', 'Done'],
            background: 'blue'
        },
        {
            id: 'scrum',
            name: 'Scrum Board',
            description: 'Manage your sprints with Backlog, Sprint Backlog, In Progress, Review, and Done.',
            lists: ['Backlog', 'Sprint Backlog', 'In Progress', 'Review', 'Done'],
            background: 'orange'
        },
        {
            id: 'roadmap',
            name: 'Product Roadmap',
            description: 'Plan your product roadmap with Q1, Q2, Q3, and Q4 lists.',
            lists: ['Q1', 'Q2', 'Q3', 'Q4'],
            background: 'green'
        },
        {
            id: 'brainstorming',
            name: 'Brainstorming',
            description: 'Collect ideas with Ideas, Voting, Approved, and Rejected lists.',
            lists: ['Ideas', 'Voting', 'Approved', 'Rejected'],
            background: 'purple'
        }
    ];

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

    async useTemplate(template: Template) {
        if (!this.selectedWorkspaceId() || this.creating()) return;

        this.creating.set(true);
        try {
            // Get unique board name by checking existing boards in workspace
            const boardName = await this.getUniqueBoardName(template.name, this.selectedWorkspaceId());

            // 1. Create Board with template lists and background
            const board = await this.workspacesApi.createBoard(this.selectedWorkspaceId(), {
                name: boardName,
                description: template.description,
                background: template.background,
                lists: template.lists
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
