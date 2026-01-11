import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Layout, LayoutTemplate, Plus } from 'lucide-angular';
import { WorkspaceLite } from '../../data/workspaces.service';

type ModuleWorkspace = WorkspaceLite & { moduleKey?: 'service_desk' | 'ecommerce_fulfillment' };

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
    readonly TemplatesIcon = LayoutTemplate;
    readonly PlusIcon = Plus;
    readonly tBoards = $localize`:@@sidebar.boards:Boards`;
    readonly tTemplates = $localize`:@@sidebar.templates:Templates`;
    readonly tModules = $localize`:@@sidebar.modules:Modules`;
    readonly tServiceDesk = $localize`:@@sidebar.serviceDesk:Service Desk`;
    readonly tFulfillment = $localize`:@@sidebar.fulfillment:E-commerce Fulfillment`;
    readonly tWorkspaces = $localize`:@@sidebar.workspaces:Workspaces`;
    readonly tCreateWorkspace = $localize`:@@sidebar.createWorkspace:Create workspace`;

    // Inputs
    workspaces = input<WorkspaceLite[]>([]);
    selectedWorkspaceId = input<string | null>(null);
    moduleWorkspaces = input<ModuleWorkspace[]>([]);

    // Outputs
    workspaceSelected = output<string>();
    createWorkspace = output<void>();
    openSettings = output<WorkspaceLite>();
    openMembers = output<WorkspaceLite>();
    openTemplates = output<void>();
    openModule = output<ModuleWorkspace>();
    openModulesModal = output<void>();

    moduleLabel(key?: ModuleWorkspace['moduleKey']) {
        if (key === 'ecommerce_fulfillment') return this.tFulfillment;
        return this.tServiceDesk;
    }
}
