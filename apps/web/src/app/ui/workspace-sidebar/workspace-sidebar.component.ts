import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Layout, Plus } from 'lucide-angular';
import { WorkspaceLite } from '../../data/workspaces.service';

@Component({
    standalone: true,
    selector: 'workspace-sidebar',
    imports: [CommonModule, LucideAngularModule],
    templateUrl: './workspace-sidebar.component.html',
    styleUrls: ['./workspace-sidebar.component.css']
})
export class WorkspaceSidebarComponent {
    // Icons
    readonly LayoutIcon = Layout;
    readonly PlusIcon = Plus;
    readonly tBoards = $localize`:@@sidebar.boards:Boards`;
    readonly tTemplates = $localize`:@@sidebar.templates:Templates`;
    readonly tWorkspaces = $localize`:@@sidebar.workspaces:Workspaces`;
    readonly tCreateWorkspace = $localize`:@@sidebar.createWorkspace:Create workspace`;

    // Inputs
    workspaces = input<WorkspaceLite[]>([]);
    selectedWorkspaceId = input<string | null>(null);

    // Outputs
    workspaceSelected = output<string>();
    createWorkspace = output<void>();
    openSettings = output<WorkspaceLite>();
    openMembers = output<WorkspaceLite>();
    openTemplates = output<void>();
}
