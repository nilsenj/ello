import { Component, computed, effect, inject, signal } from '@angular/core';
import { UserSettingsModalComponent } from '../../components/user-settings-modal/user-settings-modal.component';
import { UserSettingsModalService } from '../../components/user-settings-modal/user-settings-modal.service';


import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';

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
        <header class="hdr native-safe-header w-full relative z-50">
            <div class="mx-auto max-w-full px-2 sm:px-4 py-2 flex items-center justify-between relative min-h-[52px]">

                <!-- Left: Logo & Board Switcher -->
                <div class="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1" [class.hidden]="mobileSearchOpen()">
                    <a class="flex items-center gap-2 group shrink-0" [routerLink]="['/']">
                        <!-- Logo Icon -->
                        <div class="relative w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors backdrop-blur-sm shadow-sm ring-1 ring-white/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white drop-shadow-sm">
                                <rect x="4" y="4" width="6" height="16" rx="2" fill="currentColor" fill-opacity="0.9" />
                                <rect x="14" y="4" width="6" height="7" rx="2" fill="currentColor" fill-opacity="0.7" />
                                <rect x="14" y="13" width="6" height="7" rx="2" fill="currentColor" fill-opacity="0.5" />
                            </svg>
                        </div>
                        
                        <!-- Text hidden on mobile -->
                        <span class="hidden lg:block text-2xl font-black tracking-tighter text-white drop-shadow-sm group-hover:opacity-90 transition-opacity"
                               style="font-family: 'Inter', system-ui, -apple-system, sans-serif;">
                            ello
                        </span>
                    </a>

                    <header-board-switcher
                        class="min-w-0"
                        [currentBoardName]="currentBoardName()"
                        [currentBoardId]="store.currentBoardId()"
                        [boardsByWorkspace]="boardsByWorkspace()"
                        (switchBoard)="onSwitch($event)">
                    </header-board-switcher>
                </div>

                <!-- Center: Create & Search -->
                <!-- On mobile: taking full width if search open, or just an icon property -->
                <div class="flex items-center gap-2" [ngClass]="{
                    'absolute inset-0 bg-[var(--board-header,#026AA7)] z-20 px-4 justify-center': mobileSearchOpen(),
                    'absolute left-1/2 -translate-x-1/2 hidden md:flex': !mobileSearchOpen()
                }">
                    <!-- Back button for mobile search -->
                    <button *ngIf="mobileSearchOpen()" (click)="toggleMobileSearch()" class="text-white mr-2 md:hidden">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>
                    </button>

                    <header-create-menu
                        class="hidden md:block"
                        (createBoard)="onCreateBoardClick()"
                        (createCard)="onAddCardClick()">
                    </header-create-menu>

                    <!-- Search Input -->
                    <div class="flex-1 w-full max-w-[400px] relative">
                        <div class="relative">
                            <input
                                class="w-full rounded-md px-3 py-1.5 pl-9 text-sm text-[#172b4d] bg-white/90 focus:bg-white transition-colors border-none outline-none ring-2 ring-transparent focus:ring-blue-300/50"
                                [placeholder]="tSearchPlaceholder"
                                [ngModel]="query()"
                                (ngModelChange)="query.set($event); onSearch()"
                                (keydown.enter)="onEnter()"
                                (blur)="onBlur($event)"
                                #searchInput
                            />
                            <!-- Search Icon -->
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        </div>
                        
                        <!-- Results Dropdown -->
                        <div *ngIf="query().trim().length > 0 && showResults()" 
                             class="absolute top-full left-0 w-full mt-1 bg-white rounded-md shadow-xl border border-gray-200 overflow-hidden z-20 max-h-[80vh] overflow-y-auto">
                             
                            <div *ngIf="filteredBoards().length === 0" class="p-3 text-sm text-gray-500 text-center">
                                {{ tNoBoardsFound }}
                            </div>

                            <div *ngFor="let group of filteredBoards()">
                                <div class="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 uppercase tracking-wider">
                                    {{ group.workspaceName }}
                                </div>
                                <button *ngFor="let board of group.boards"
                                        (click)="onSelectBoard(board.id); toggleMobileSearch()"
                                        class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors">
                                    <div class="w-4 h-4 rounded-sm bg-gray-200 shrink-0" 
                                         [style.background]="getBoardColor(board.background)"></div>
                                    {{ board.name }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right: Notifications, Search Toggle (Mobile), User -->
                <div class="flex items-center gap-1.5 sm:gap-2 shrink-0" [class.hidden]="mobileSearchOpen()">
                    <!-- Mobile Search Toggle -->
                    <button class="md:hidden pill p-1.5 sm:p-2 text-white hover:bg-white/20 transition-colors rounded-md shrink-0" (click)="toggleMobileSearch()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </button>

                    <!-- Mobile Create Button (simplified) -->
                    <button class="md:hidden pill p-1.5 sm:p-2 text-white hover:bg-white/20 transition-colors rounded-md shrink-0" (click)="onCreateBoardClick()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    </button>

                    <header-notifications
                        class="shrink-0"
                        [unreadCount]="unreadCount()"
                        [notifications]="notifications()"
                        (markAsRead)="markNotificationAsRead($event)"
                        (deleteNotification)="deleteNotification($event)"
                        (markAllAsRead)="markAllAsRead()">
                    </header-notifications>

                    <header-user-menu
                        class="shrink-0"
                        [user]="user()"
                        [initials]="initials()"
                        (logout)="logout()"
                        (goProfile)="goProfile()">
                    </header-user-menu>
                </div>
            </div>


            <!-- Mount modals -->
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
    readonly tSearchPlaceholder = $localize`:@@header.searchPlaceholder:Jump to board...`;
    readonly tNoBoardsFound = $localize`:@@header.noBoardsFound:No boards found`;
    readonly tOtherWorkspace = $localize`:@@header.otherWorkspace:Other`;

    // Notification signals
    notifications = this.notificationsStore.allNotifications;
    unreadCount = this.notificationsStore.unreadNotificationsCount;

    currentBoardName = computed(() => {
        const id = this.store.currentBoardId();
        const fallback = $localize`:@@header.selectBoard:Select Board`;
        if (!id) return fallback;
        return this.store.boards().find(b => b.id === id)?.name || fallback;
    });

    private routeUrl = signal(this.router.url);

    // Group boards by workspace (show Service Desk boards only within Service Desk module)
    boardsByWorkspace = computed(() => {
        const boards = this.store.boards().filter(b => !b.isArchived);
        const workspaces = this.workspaces();
        const isServiceDeskView = this.isServiceDeskRoute();
        const serviceDeskBoards = boards.filter(b => b.type === 'service_desk');
        const visibleBoards = isServiceDeskView
            ? (serviceDeskBoards.length ? serviceDeskBoards : boards)
            : boards;

        const groups = workspaces.map(ws => ({
            workspaceId: ws.id,
            workspaceName: ws.name,
            boards: visibleBoards.filter(b => b.workspaceId === ws.id)
        }));

        // Add boards with no workspace or unknown workspace
        const otherBoards = visibleBoards.filter(b => !workspaces.find(w => w.id === b.workspaceId));
        if (otherBoards.length > 0) {
            groups.push({
                workspaceId: 'other',
                workspaceName: this.tOtherWorkspace,
                boards: otherBoards
            });
        }

        return groups.filter(g => g.boards.length > 0);
    });

    constructor() {
        this.loadWorkspaces();
        this.router.events.subscribe(event => {
            if (event instanceof NavigationEnd) {
                this.routeUrl.set(event.urlAfterRedirects);
            }
        });
        effect(() => {
            this.auth.isAuthed();
            this.store.currentBoardId();
            if (this.auth.isAuthed() && this.store.boards().length === 0) {
                void this.boardsApi.loadBoards().catch(() => null);
            }
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
    mobileSearchOpen = signal(false);

    toggleMobileSearch() {
        this.mobileSearchOpen.update(v => !v);
        // focus input next tick if opening?
    }

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

    private isServiceDeskRoute(): boolean {
        return /\/service-desk(\/|$)/.test(this.routeUrl());
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
