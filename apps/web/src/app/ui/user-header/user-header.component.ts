import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import { BoardsService } from '../../data/boards.service';
import { BoardStore } from '../../store/board-store.service';
import { CardsService } from "../../data/cards.service";
import { BoardCreateModalService } from "../../components/board-create-modal/board-create-modal.service";
import { CardCreateModalService } from "../../components/card-create-modal/card-create-modal.service";
import { BoardCreateModalComponent } from "../../components/board-create-modal/board-create-modal.component";
import { CardCreateModalComponent } from "../../components/card-create-modal/card-create-modal.component";

@Component({
    standalone: true,
    selector: 'user-header',
    imports: [CommonModule, FormsModule, RouterLink, BoardCreateModalComponent, CardCreateModalComponent],
    styles: [`
        :host {
            display: block;
        }

        .hdr {
            background: var(--board-header, #026AA7);
            color: #fff;
        }

        .btn {
            background: #fff;
            color: #172b4d;
            border-radius: .375rem;
            padding: .375rem .625rem;
            font-size: .875rem;
        }

        .pill {
            background: rgba(255, 255, 255, .2);
            border-radius: .375rem;
            padding: .25rem .5rem;
        }

        .select {
            appearance: none;
            background: rgba(255, 255, 255, .2);
            color: #fff;
            border-radius: .375rem;
            padding: .375rem 2rem .375rem .75rem;
            font-size: .875rem;
        }

        .select:focus, input:focus {
            outline: 2px solid rgba(255, 255, 255, .7);
            outline-offset: 1px;
        }

        .menu {
            position: relative;
        }

        .menu-content {
            position: absolute;
            right: 0;
            top: 100%;
            min-width: 220px;
            background: #fff;
            color: #172b4d;
            border-radius: .5rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, .2);
            padding: .5rem;
            z-index: 100;
        }

        .menu-item {
            padding: .5rem .625rem;
            border-radius: .375rem;
            cursor: pointer;
        }

        .menu-item:hover {
            background: #F2F4F7;
        }

        .avatar {
            width: 32px;
            height: 32px;
            border-radius: 9999px;
            background: #2d3748;
            display: inline-grid;
            place-items: center;
            color: #fff;
            font-weight: 600;
        }

        .icon {
            width: 18px;
            height: 18px;
            opacity: .9;
        }

        .gap-2 > * + * {
            margin-left: .5rem;
        }

        .gap-3 > * + * {
            margin-left: .75rem;
        }
    `],
    template: `
        <header class="hdr w-full relative z-50">
            <div class="mx-auto max-w-full px-4 py-2 flex items-center justify-between relative">
                
                <!-- Left: Logo & Board Switcher -->
                <div class="flex items-center gap-3 shrink-0">
                    <a class="flex items-center gap-2" [routerLink]="['/']">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white opacity-90 hover:opacity-100 transition-opacity">
                            <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" fill-opacity="0.4"/>
                            <rect x="13" y="3" width="8" height="8" rx="1" fill="currentColor" fill-opacity="0.6"/>
                            <rect x="3" y="13" width="8" height="8" rx="1" fill="currentColor" fill-opacity="0.8"/>
                            <rect x="13" y="13" width="8" height="8" rx="1" fill="currentColor"/>
                        </svg>
                        <span class="font-bold text-lg tracking-tight text-white/90 hover:text-white transition-colors">Ello</span>
                    </a>

                    <!-- Board switcher -->
                    <div class="relative inline-flex items-center" (focusout)="closeBoardIfBlur($event)">
                        <button class="pill px-3 py-1.5 flex items-center gap-2 hover:bg-white/30 transition-colors text-white" (click)="toggleBoardMenu()">
                            <span class="truncate max-w-[150px] font-medium">{{ currentBoardName() }}</span>
                            <svg class="w-4 h-4 opacity-80 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.25 7.5l4.5 4.5 4.5-4.5"/>
                            </svg>
                        </button>

                        <div class="menu-content left-0 mt-1 w-64 origin-top-left max-h-[400px] overflow-y-auto" *ngIf="boardMenuOpen()">
                            <div class="px-4 py-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Boards</div>
                            </div>
                            <div class="p-2">
                                <button *ngFor="let b of store.boards()" 
                                        class="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2 group"
                                        [class.bg-blue-50]="b.id === store.currentBoardId()"
                                        [class.text-blue-700]="b.id === store.currentBoardId()"
                                        (click)="onSwitch(b.id)">
                                    <span class="w-8 h-6 rounded bg-cover bg-center shrink-0 border border-gray-200"
                                          [style.background-image]="b.background?.startsWith('http') ? 'url(' + b.background + ')' : null"
                                          [style.background-color]="!b.background?.startsWith('http') ? b.background : null">
                                    </span>
                                    <span class="truncate font-medium">{{ b.name }}</span>
                                    <span *ngIf="b.id === store.currentBoardId()" class="ml-auto text-blue-600">
                                        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                        </svg>
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Center: Create & Search -->
                <div class="flex items-center gap-2 absolute left-1/2 -translate-x-1/2 w-full max-w-[600px] justify-center">
                    <!-- Create Dropdown -->
                    <div class="relative shrink-0" (focusout)="closeCreateIfBlur($event)">
                        <button class="btn bg-white/10 text-white hover:bg-white/20 border-none flex items-center gap-2" (click)="toggleCreateMenu()">
                            <span>Create</span>
                            <svg class="w-4 h-4 opacity-80" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.25 7.5l4.5 4.5 4.5-4.5"/>
                            </svg>
                        </button>

                        <div class="menu-content left-0 mt-1 w-64 origin-top-left" *ngIf="createMenuOpen()">
                            <div class="px-4 py-2 border-b border-gray-100">
                                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Create</div>
                            </div>
                            <div class="p-2">
                                <button class="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex flex-col gap-0.5" (click)="onCreateBoardClick()">
                                    <span class="text-sm font-medium text-gray-700">Create board</span>
                                    <span class="text-xs text-gray-500">A board is made up of cards ordered on lists.</span>
                                </button>
                                <button class="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex flex-col gap-0.5" (click)="onAddCardClick()">
                                    <span class="text-sm font-medium text-gray-700">Create card</span>
                                    <span class="text-xs text-gray-500">Create a card to track a task.</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Search -->
                    <div class="flex-1 max-w-[400px]">
                        <input
                                class="w-full rounded-md px-3 py-1.5 text-sm text-[#172b4d] bg-white/90 focus:bg-white transition-colors border-none outline-none ring-2 ring-transparent focus:ring-blue-300/50"
                                placeholder="Search cards…"
                                [ngModel]="query()"
                                (ngModelChange)="query.set($event); onSearch()"/>
                    </div>
                </div>

                <!-- Right: Notifications & User -->
                <div class="ml-auto flex items-center gap-3 shrink-0">
                    <!-- Notifications -->
                    <div class="relative" (focusout)="closeNotificationIfBlur($event)">
                        <button class="pill p-2 hover:bg-white/30 transition-colors relative" title="Notifications" (click)="toggleNotificationMenu()">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 006 14h12a1 1 0 00.707-1.707L18 11.586V8a6 6 0 00-6-6zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                            </svg>
                            <!-- Badge example (hidden for now) -->
                            <!-- <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span> -->
                        </button>

                        <div class="menu-content right-0 mt-1 w-80 origin-top-right" *ngIf="notificationMenuOpen()">
                            <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                <div class="text-sm font-semibold text-gray-700">Notifications</div>
                                <button class="text-xs text-blue-600 hover:underline">Mark all as read</button>
                            </div>
                            <div class="p-4 text-center text-gray-500 text-sm py-8">
                                <div class="mb-2 mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg class="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>
                                No new notifications
                            </div>
                        </div>
                    </div>

                    <!-- User menu -->
                    <div class="menu" (focusout)="closeIfBlur($event)">
                        <button class="pill p-1.5 flex items-center gap-2 hover:bg-white/30 transition-colors" (click)="toggleMenu()">
                            <span class="avatar ring-2 ring-white/20" *ngIf="!user()?.avatar">{{ initials() }}</span>
                            <img *ngIf="user()?.avatar" class="avatar ring-2 ring-white/20" [src]="user()?.avatar" alt="">
                            <span class="hidden md:inline text-sm font-medium">{{ user()?.name || user()?.email }}</span>
                            <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.25 7.5l4.5 4.5 4.5-4.5"/>
                            </svg>
                        </button>

                        <div class="menu-content" *ngIf="menuOpen()">
                            <div class="px-4 py-3 border-b border-gray-100">
                                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Account</div>
                                <div class="text-sm font-medium text-gray-900">{{ user()?.name || 'User' }}</div>
                                <div class="text-xs text-gray-500 truncate">{{ user()?.email }}</div>
                            </div>
                            <div class="p-2">
                                <div class="menu-item" (click)="goProfile()">Profile & Settings</div>
                                <div class="menu-item text-red-600 hover:bg-red-50" (click)="logout()">Log out</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mount modals once; they overlay the whole page -->
            <board-create-modal></board-create-modal>
            <card-create-modal></card-create-modal>
        </header>
    `
})
export class UserHeaderComponent {
    private router = inject(Router);
    store = inject(BoardStore);
    boardsApi = inject(BoardsService);
    auth = inject(AuthService);
    cardService = inject(CardsService);

    // NEW: modal services
    boardModal = inject(BoardCreateModalService);
    cardModal = inject(CardCreateModalService);

    // UI state
    menuOpen = signal(false);
    createMenuOpen = signal(false);
    boardMenuOpen = signal(false);
    notificationMenuOpen = signal(false);
    query = signal('');

    user = computed(() => this.auth.user());
    initials = () => (this.user()?.name || this.user()?.email || 'U').trim().slice(0, 2).toUpperCase();

    currentBoardName = computed(() => {
        const id = this.store.currentBoardId();
        if (!id) return 'Select Board';
        return this.store.boards().find(b => b.id === id)?.name || 'Select Board';
    });

    constructor() {
        effect(() => {
            this.auth.isAuthed();
            this.store.currentBoardId();
        });
    }

    toggleMenu() {
        this.menuOpen.update(v => !v);
        if (this.menuOpen()) {
            this.createMenuOpen.set(false);
            this.boardMenuOpen.set(false);
            this.notificationMenuOpen.set(false);
        }
    }

    toggleCreateMenu() {
        this.createMenuOpen.update(v => !v);
        if (this.createMenuOpen()) {
            this.menuOpen.set(false);
            this.boardMenuOpen.set(false);
            this.notificationMenuOpen.set(false);
        }
    }

    toggleBoardMenu() {
        this.boardMenuOpen.update(v => !v);
        if (this.boardMenuOpen()) {
            this.menuOpen.set(false);
            this.createMenuOpen.set(false);
            this.notificationMenuOpen.set(false);
        }
    }

    toggleNotificationMenu() {
        this.notificationMenuOpen.update(v => !v);
        if (this.notificationMenuOpen()) {
            this.menuOpen.set(false);
            this.createMenuOpen.set(false);
            this.boardMenuOpen.set(false);
        }
    }

    closeIfBlur(ev: FocusEvent) {
        const next = ev.relatedTarget as HTMLElement | null;
        if (!next || !(ev.currentTarget as HTMLElement).contains(next)) this.menuOpen.set(false);
    }

    closeCreateIfBlur(ev: FocusEvent) {
        const next = ev.relatedTarget as HTMLElement | null;
        if (!next || !(ev.currentTarget as HTMLElement).contains(next)) this.createMenuOpen.set(false);
    }

    closeBoardIfBlur(ev: FocusEvent) {
        const next = ev.relatedTarget as HTMLElement | null;
        if (!next || !(ev.currentTarget as HTMLElement).contains(next)) this.boardMenuOpen.set(false);
    }

    closeNotificationIfBlur(ev: FocusEvent) {
        const next = ev.relatedTarget as HTMLElement | null;
        if (!next || !(ev.currentTarget as HTMLElement).contains(next)) this.notificationMenuOpen.set(false);
    }

    async onSwitch(id: string) {
        if (!id) return;
        this.boardMenuOpen.set(false);
        this.router.navigate(['/b', id]);
        await this.boardsApi.selectBoard(id);
    }

    onSearch() {
        // integrate with store filter if you have one
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
        alert('Profile placeholder');
    }

    async logout() {
        await this.auth.logout();
        this.router.navigate(['/login']);
    }
}
