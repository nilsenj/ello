import { Component, computed, effect, inject, signal } from '@angular/core';
import { UserSettingsModalComponent } from '../../components/user-settings-modal/user-settings-modal.component';
import { UserSettingsModalService } from '../../components/user-settings-modal/user-settings-modal.service';


import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import { BoardsService } from '../../data/boards.service';
import { BoardStore } from '../../store/board-store.service';
import { CardsService } from "../../data/cards.service";
import { WorkspacesService } from '../../data/workspaces.service';
import { BoardCreateModalService } from "../../components/board-create-modal/board-create-modal.service";
import { CardCreateModalService } from "../../components/card-create-modal/card-create-modal.service";
import { BoardCreateModalComponent } from "../../components/board-create-modal/board-create-modal.component";
import { CardCreateModalComponent } from "../../components/card-create-modal/card-create-modal.component";
import { NotificationsStore } from '../../data/notifications-store.service';
import { SocketService } from '../../data/socket.service';
import { HeaderBoardSwitcherComponent } from '../header/header-board-switcher/header-board-switcher.component';
import { HeaderCreateMenuComponent } from '../header/header-create-menu/header-create-menu.component';
import { HeaderNotificationsComponent } from '../header/header-notifications/header-notifications.component';
import { HeaderUserMenuComponent } from '../header/header-user-menu/header-user-menu.component';

@Component({
    // Force rebuild
    standalone: true,
    selector: 'user-header',
    imports: [
        CommonModule, // CommonModule includes NgIf and NgFor
        FormsModule,
        RouterLink,
        BoardCreateModalComponent,
        CardCreateModalComponent,
        UserSettingsModalComponent,
        HeaderBoardSwitcherComponent,
        HeaderCreateMenuComponent,
        HeaderNotificationsComponent,
        HeaderUserMenuComponent
    ],
    styles: [`
        :host {
            display: block;
        }

        .hdr {
            background: var(--board-header, #026AA7);
            color: #fff;
        }
    `],
    template: `
        <header class="hdr w-full relative z-50">
            <div class="mx-auto max-w-full px-4 py-2 flex items-center justify-between relative">

                <!-- Left: Logo & Board Switcher -->
                <div class="flex items-center gap-3 shrink-0">
                    <a class="flex items-center gap-2.5 group" [routerLink]="['/']">
                        <!-- New Logo: Abstract 'e' / Board columns -->
                        <div class="relative w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors backdrop-blur-sm shadow-sm ring-1 ring-white/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white drop-shadow-sm">
                                <!-- Left column (shorter) -->
                                <rect x="4" y="4" width="6" height="16" rx="2" fill="currentColor" fill-opacity="0.9" />
                                <!-- Right column (top part) -->
                                <rect x="14" y="4" width="6" height="7" rx="2" fill="currentColor" fill-opacity="0.7" />
                                <!-- Right column (bottom part) -->
                                <rect x="14" y="13" width="6" height="7" rx="2" fill="currentColor" fill-opacity="0.5" />
                            </svg>
                        </div>
                        
                        <span class="text-2xl font-black tracking-tighter text-white drop-shadow-sm group-hover:opacity-90 transition-opacity"
                              style="font-family: 'Inter', system-ui, -apple-system, sans-serif;">
                            ello
                        </span>
                    </a>

                    <header-board-switcher
                        [currentBoardName]="currentBoardName()"
                        [currentBoardId]="store.currentBoardId()"
                        [boardsByWorkspace]="boardsByWorkspace()"
                        (switchBoard)="onSwitch($event)">
                    </header-board-switcher>
                </div>

                <!-- Center: Create & Search -->
                <div class="flex items-center gap-2 absolute left-1/2 -translate-x-1/2 w-full max-w-[600px] justify-center">
                    <header-create-menu
                        (createBoard)="onCreateBoardClick()"
                        (createCard)="onAddCardClick()">
                    </header-create-menu>

                    <!-- Search -->
                    <div class="flex-1 max-w-[400px] relative">
                        <div class="relative">
                            <input
                                class="w-full rounded-md px-3 py-1.5 pl-9 text-sm text-[#172b4d] bg-white/90 focus:bg-white transition-colors border-none outline-none ring-2 ring-transparent focus:ring-blue-300/50"
                                placeholder="Jump to board..."
                                [ngModel]="query()"
                                (ngModelChange)="query.set($event); onSearch()"
                                (keydown.enter)="onEnter()"
                                (blur)="onBlur($event)"
                            />
                            <!-- Search Icon -->
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        </div>

                        <!-- Search Results Dropdown -->
                        <div *ngIf="query().trim().length > 0 && showResults()" 
                             class="absolute top-full left-0 w-full mt-1 bg-white rounded-md shadow-xl border border-gray-200 overflow-hidden z-50 max-h-[400px] overflow-y-auto">
                            
                            <div *ngIf="filteredBoards().length === 0" class="p-3 text-sm text-gray-500 text-center">
                                No boards found
                            </div>

                            <div *ngFor="let group of filteredBoards()">
                                <div class="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 uppercase tracking-wider">
                                    {{ group.workspaceName }}
                                </div>
                                <button *ngFor="let board of group.boards"
                                        (click)="onSelectBoard(board.id)"
                                        class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors">
                                    <div class="w-4 h-4 rounded-sm bg-gray-200 shrink-0" 
                                         [style.background]="getBoardColor(board.background)"></div>
                                    {{ board.name }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right: Notifications & User -->
                <div class="ml-auto flex items-center gap-3 shrink-0">
                    <header-notifications
                        [unreadCount]="unreadCount()"
                        [notifications]="notifications()"
                        (markAsRead)="markNotificationAsRead($event)"
                        (deleteNotification)="deleteNotification($event)"
                        (markAllAsRead)="markAllAsRead()">
                    </header-notifications>

                    <header-user-menu
                        [user]="user()"
                        [initials]="initials()"
                        (logout)="logout()"
                        (goProfile)="goProfile()">
                    </header-user-menu>
                </div>
            </div>

            <!-- Mount modals once; they overlay the whole page -->
            <board-create-modal></board-create-modal>
            <card-create-modal></card-create-modal>
            <user-settings-modal></user-settings-modal>
        </header>
    `
})
export class UserHeaderComponent {
    private router = inject(Router);
    store = inject(BoardStore);
    boardsApi = inject(BoardsService);
    workspacesApi = inject(WorkspacesService);
    auth = inject(AuthService);
    cardService = inject(CardsService);

    // NEW: modal services
    boardModal = inject(BoardCreateModalService);
    cardModal = inject(CardCreateModalService);
    userSettingsModal = inject(UserSettingsModalService);
    socketService = inject(SocketService);
    notificationsStore = inject(NotificationsStore);

    // UI state
    query = signal('');
    workspaces = signal<any[]>([]);

    user = computed(() => this.auth.user());
    initials = () => (this.user()?.name || this.user()?.email || 'U').trim().slice(0, 2).toUpperCase();

    // Notification signals
    notifications = this.notificationsStore.allNotifications;
    unreadCount = this.notificationsStore.unreadNotificationsCount;

    currentBoardName = computed(() => {
        const id = this.store.currentBoardId();
        if (!id) return 'Select Board';
        return this.store.boards().find(b => b.id === id)?.name || 'Select Board';
    });

    // Group boards by workspace
    boardsByWorkspace = computed(() => {
        const boards = this.store.boards().filter(b => !b.isArchived);
        const workspaces = this.workspaces();

        const groups = workspaces.map(ws => ({
            workspaceId: ws.id,
            workspaceName: ws.name,
            boards: boards.filter(b => b.workspaceId === ws.id)
        }));

        // Add boards with no workspace or unknown workspace
        const otherBoards = boards.filter(b => !workspaces.find(w => w.id === b.workspaceId));
        if (otherBoards.length > 0) {
            groups.push({
                workspaceId: 'other',
                workspaceName: 'Other',
                boards: otherBoards
            });
        }

        return groups.filter(g => g.boards.length > 0);
    });

    constructor() {
        this.loadWorkspaces();
        effect(() => {
            this.auth.isAuthed();
            this.store.currentBoardId();
        });
    }

    async loadWorkspaces() {
        try {
            const list = await this.workspacesApi.list();
            this.workspaces.set(list);
        } catch (err) {
            console.error('Failed to load workspaces', err);
        }
    }

    async onSwitch(id: string) {
        if (!id) return;
        this.router.navigate(['/b', id]);
        await this.boardsApi.selectBoard(id);
    }

    // Search state
    showResults = signal(false);

    filteredBoards = computed(() => {
        const q = this.query().trim().toLowerCase();
        if (!q) return [];

        const groups = this.boardsByWorkspace();
        return groups.map(g => ({
            ...g,
            boards: g.boards.filter(b => b.name.toLowerCase().includes(q))
        })).filter(g => g.boards.length > 0);
    });

    onSearch() {
        this.showResults.set(true);
    }

    onBlur(event: FocusEvent) {
        // Delay hiding to allow click event to register
        setTimeout(() => {
            this.showResults.set(false);
        }, 200);
    }

    onSelectBoard(boardId: string) {
        this.router.navigate(['/b', boardId]);
        this.query.set('');
        this.showResults.set(false);
        this.boardsApi.selectBoard(boardId);
    }

    onEnter() {
        const results = this.filteredBoards();
        if (results.length > 0 && results[0].boards.length > 0) {
            this.onSelectBoard(results[0].boards[0].id);
        }
    }

    getBoardColor(bg: string): string {
        const colors: Record<string, string> = {
            'blue': '#0079BF',
            'orange': '#D29034',
            'green': '#519839',
            'red': '#B04632',
            'purple': '#89609E',
            'pink': '#CD5A91',
            'lime': '#4BBF6B',
            'sky': '#00AECC',
            'grey': '#838C91',
        };
        return colors[bg] || '#838C91';
    }

    // OPEN MODALS instead of prompt()
    onCreateBoardClick() {
        this.boardModal.open();
    }

    onAddCardClick() {
        this.cardModal.open();
        // default list is selected via openWithDefaults() when DOM renders (see cdkObserveContent in template)
    }

    goProfile() {
        console.log('Opening user settings modal');
        this.userSettingsModal.open();
    }

    // Notification actions
    async markNotificationAsRead(notificationId: string) {
        await this.notificationsStore.markAsRead(notificationId);
    }

    async deleteNotification(notificationId: string) {
        await this.notificationsStore.deleteNotification(notificationId);
    }

    async markAllAsRead() {
        await this.notificationsStore.markAllAsRead();
    }

    async logout() {
        await this.auth.logout();
        this.router.navigate(['/login']);
    }
}
