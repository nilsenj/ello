import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { BoardStore } from '../../store/board-store.service';
import { WorkspacesService, WorkspaceLite } from '../../data/workspaces.service';
import { BoardsService } from '../../data/boards.service';
import { LucideAngularModule, Layout, Settings, Home, Plus, User, Users } from 'lucide-angular';
import { BoardCreateModalComponent } from '../../components/board-create-modal/board-create-modal.component';
import { BoardCreateModalService } from '../../components/board-create-modal/board-create-modal.service';
import { UserHeaderComponent } from '../../ui/user-header/user-header.component';

@Component({
    standalone: true,
    selector: 'home-page',
    imports: [CommonModule, RouterModule, LucideAngularModule, BoardCreateModalComponent, UserHeaderComponent],
    templateUrl: './home-page.component.html',
    styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit {
    // Icons
    readonly LayoutIcon = Layout;
    readonly SettingsIcon = Settings;
    readonly HomeIcon = Home;
    readonly PlusIcon = Plus;
    readonly UserIcon = User;
    readonly UsersIcon = Users;

    // Services
    private router = inject(Router);
    private store = inject(BoardStore);
    private workspacesApi = inject(WorkspacesService);
    private boardsApi = inject(BoardsService);
    private createModal = inject(BoardCreateModalService);

    // State
    workspaces = signal<WorkspaceLite[]>([]);
    boards = this.store.boards; // Signal<Board[]>

    async ngOnInit() {
        // Load initial data
        await Promise.all([
            this.loadWorkspaces(),
            this.boardsApi.loadBoards()
        ]);
    }

    async loadWorkspaces() {
        const list = await this.workspacesApi.list();
        this.workspaces.set(list);
    }

    getBoardsForWorkspace(workspaceId: string) {
        return this.boards().filter(b => b.workspaceId === workspaceId);
    }

    openCreateBoard(workspaceId?: string) {
        // TODO: Pre-select workspace in modal if provided
        this.createModal.open();
    }
}
