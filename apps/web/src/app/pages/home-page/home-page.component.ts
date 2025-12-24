import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { BoardStore } from '../../store/board-store.service';
import { WorkspaceLite, WorkspacesService } from '../../data/workspaces.service';
import { BoardsService } from '../../data/boards.service';
import { ArchiveIcon, ClockIcon, LucideAngularModule, Plus, Settings, StarIcon, Users, XIcon, Upload } from 'lucide-angular';
import { BoardCreateModalComponent } from '../../components/board-create-modal/board-create-modal.component';
import { BoardCreateModalService } from '../../components/board-create-modal/board-create-modal.service';
import { WorkspaceCreateModalComponent } from '../../components/workspace-create-modal/workspace-create-modal.component';
import { WorkspaceCreateModalService } from '../../components/workspace-create-modal/workspace-create-modal.service';
import {
    WorkspaceSettingsModalComponent
} from '../../components/workspace-settings-modal/workspace-settings-modal.component';
import {
    WorkspaceSettingsModalService
} from '../../components/workspace-settings-modal/workspace-settings-modal.service';
import {
    WorkspaceSettingsAdvancedModalComponent
} from '../../components/workspace-settings-advanced-modal/workspace-settings-advanced-modal.component';
import {
    WorkspaceMembersModalComponent
} from '../../components/workspace-members-modal/workspace-members-modal.component';
import { WorkspaceMembersModalService } from '../../components/workspace-members-modal/workspace-members-modal.service';
import { TemplatesModalComponent } from '../../components/templates-modal/templates-modal.component';
import { TemplatesModalService } from '../../components/templates-modal/templates-modal.service';
import { UserHeaderComponent } from '../../ui/user-header/user-header.component';
import { WorkspaceSidebarComponent } from '../../ui/workspace-sidebar/workspace-sidebar.component';

@Component({
    standalone: true,
    selector: 'home-page',
    imports: [CommonModule, RouterModule, LucideAngularModule, BoardCreateModalComponent, WorkspaceCreateModalComponent, WorkspaceSettingsModalComponent, WorkspaceSettingsAdvancedModalComponent, WorkspaceMembersModalComponent, TemplatesModalComponent, UserHeaderComponent, WorkspaceSidebarComponent],
    templateUrl: './home-page.component.html',
    styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit {
    // Icons
    readonly SettingsIcon = Settings;
    readonly UsersIcon = Users;
    readonly ClockIcon = ClockIcon;
    readonly StarIcon = StarIcon;
    readonly PlusIcon = Plus;
    readonly UploadIcon = Upload;

    // Services
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private store = inject(BoardStore);
    private workspacesApi = inject(WorkspacesService);
    private boardsApi = inject(BoardsService);
    private createBoardModal = inject(BoardCreateModalService);
    private createWorkspaceModal = inject(WorkspaceCreateModalService);
    private settingsWorkspaceModal = inject(WorkspaceSettingsModalService);
    private membersWorkspaceModal = inject(WorkspaceMembersModalService);
    private templatesModal = inject(TemplatesModalService);

    // State
    workspaces = signal<WorkspaceLite[]>([]);
    boards = this.store.boards; // Signal<Board[]>
    loading = signal<boolean>(true);
    sidebarOpen = signal<boolean>(false);

    toggleSidebar() {
        this.sidebarOpen.update(v => !v);
    }

    // Recent
    recentBoards = computed(() => {
        const ids = this.recentBoardIds();
        const all = this.boards();
        return ids.map(id => all.find(b => b.id === id)).filter(Boolean) as any[];
    });
    private recentBoardIds = signal<string[]>([]);

    // Starred
    starredBoards = computed(() => {
        const ids = this.starredBoardIds();
        const all = this.boards();
        return ids.map(id => all.find(b => b.id === id)).filter(Boolean) as any[];
    });
    starredBoardIds = signal<string[]>([]);

    selectedWorkspaceId = signal<string | null>(null);
    selectedWorkspace = computed(() => {
        const id = this.selectedWorkspaceId();
        return this.workspaces().find(w => w.id === id);
    });

    // Archive Modal State
    boardToArchive = signal<string | null>(null);
    boardToArchiveName = signal<string>('');

    async ngOnInit() {
        this.loadRecentIds();
        this.loadStarredIds();

        try {
            // Load initial data
            await Promise.all([
                this.loadWorkspaces(),
                this.boardsApi.loadBoards()
            ]);
        } finally {
            this.loading.set(false);
        }

        // Subscribe to route params to update selected workspace
        this.route.paramMap.subscribe(params => {
            const wsId = params.get('workspaceId');
            if (wsId) {
                this.selectedWorkspaceId.set(wsId);
            } else if (this.workspaces().length > 0 && !this.selectedWorkspaceId()) {
                // If no param but we have workspaces, default to first (and maybe redirect?)
                // For now, just set it locally or redirect to /w/:id
                const first = this.workspaces()[0];
                this.router.navigate(['/w', first.id], { replaceUrl: true });
            }
        });
    }

    private loadRecentIds() {
        if (typeof window !== 'undefined') {
            try {
                const recent: string[] = JSON.parse(localStorage.getItem('recent_boards') || '[]');
                this.recentBoardIds.set(recent);
            } catch (e) { /* noop */ }
        }
    }

    private loadStarredIds() {
        if (typeof window !== 'undefined') {
            try {
                const starred: string[] = JSON.parse(localStorage.getItem('starred_boards') || '[]');
                this.starredBoardIds.set(starred);
            } catch (e) { /* noop */ }
        }
    }

    isStarred(boardId: string) {
        return this.starredBoardIds().includes(boardId);
    }

    toggleStar(event: Event, boardId: string) {
        event.preventDefault();
        event.stopPropagation();

        const current = this.starredBoardIds();
        let next: string[];

        if (current.includes(boardId)) {
            next = current.filter(id => id !== boardId);
        } else {
            next = [boardId, ...current];
        }

        this.starredBoardIds.set(next);

        if (typeof window !== 'undefined') {
            localStorage.setItem('starred_boards', JSON.stringify(next));
        }
    }

    async loadWorkspaces() {
        const list = await this.workspacesApi.list();
        this.workspaces.set(list);
    }

    onWorkspaceSelected(id: string) {
        this.router.navigate(['/w', id]);
    }

    getBoardsForWorkspace(workspaceId: string) {
        return this.boards().filter(b => b.workspaceId === workspaceId && !b.isArchived);
    }

    getBoardBackground(board: any): string {
        const bg = board?.background;

        const bgMap: Record<string, string> = {
            'none': 'bg-slate-50',
            'blue': 'bg-blue-500',
            'green': 'bg-green-500',
            'purple': 'bg-purple-500',
            'red': 'bg-red-500',
            'orange': 'bg-orange-500',
            'pink': 'bg-pink-500',
            'gradient-blue': 'bg-gradient-to-br from-blue-400 to-cyan-500',
            'gradient-purple': 'bg-gradient-to-br from-purple-400 to-pink-500',
            'gradient-sunset': 'bg-gradient-to-br from-orange-400 to-red-500',
            'gradient-forest': 'bg-gradient-to-br from-green-400 to-emerald-600',
            'gradient-ocean': 'bg-gradient-to-br from-cyan-500 to-blue-700',
        };

        return bg && bgMap[bg] ? bgMap[bg] : 'bg-slate-50';
    }

    getBoardTextColor(board: any): string {
        const bg = board?.background;
        // if background is 'none' (or undefined/null which defaults to slate-50), use dark text
        if (!bg || bg === 'none') {
            return 'text-slate-700';
        }
        // otherwise (colored backgrounds), use white text
        return 'text-white';
    }

    openCreateBoard(workspaceId?: string) {
        this.createBoardModal.open(workspaceId);
    }

    openCreateWorkspace() {
        this.createWorkspaceModal.open();
    }

    openWorkspaceSettings(workspace: WorkspaceLite) {
        this.settingsWorkspaceModal.open(workspace);
    }

    openWorkspaceMembers(workspace: WorkspaceLite) {
        this.membersWorkspaceModal.open(workspace);
    }

    canCreateBoard(ws: WorkspaceLite): boolean {
        // console.log('canCreateBoard check:', ws.name, ws.whoCanCreateBoards, ws.role);
        if (ws.whoCanCreateBoards === 'admins') {
            return ws.role === 'owner' || ws.role === 'admin';
        }
        return true;
    }

    canEditWorkspace(ws: WorkspaceLite): boolean {
        return ws.role === 'owner' || ws.role === 'admin';
    }

    canInviteMembers(ws: WorkspaceLite): boolean {
        if (ws.whoCanInviteMembers === 'admins') {
            return ws.role === 'owner' || ws.role === 'admin';
        }
        return true;
    }

    openTemplates() {
        this.templatesModal.open();
    }

    canArchiveBoard(ws: WorkspaceLite): boolean {
        // Workspace admins/owners can archive any board in the workspace
        return ws.role === 'owner' || ws.role === 'admin';
    }


    requestArchiveBoard(event: Event, board: any) {
        event.preventDefault();
        event.stopPropagation();
        this.boardToArchive.set(board.id);
        this.boardToArchiveName.set(board.name);
    }

    openBoard(boardId: string, event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (target.closest('button,[data-stop-open]')) return;
        this.router.navigate(['/b', boardId]);
    }

    async importBoardToWorkspace(event: Event, workspaceId: string) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            const board = await this.boardsApi.importBoard(workspaceId, payload);
            this.router.navigate(['/b', board.id]);
        } catch (err) {
            console.error('Failed to import board', err);
            alert('Failed to import board');
        } finally {
            input.value = '';
        }
    }

    closeArchiveModal() {
        this.boardToArchive.set(null);
        this.boardToArchiveName.set('');
    }

    async confirmArchive() {
        const boardId = this.boardToArchive();
        if (!boardId) return;

        try {
            await this.boardsApi.updateBoard(boardId, { isArchived: true });
            await this.boardsApi.loadBoards();
            this.closeArchiveModal();
        } catch (err) {
            console.error('Failed to archive board', err);
            alert('Failed to archive board');
        }
    }

    protected readonly ArchiveIcon = ArchiveIcon;
    protected readonly XIcon = XIcon;
}
