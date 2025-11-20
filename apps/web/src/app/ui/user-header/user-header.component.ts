import {Component, computed, effect, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';

import {AuthService} from '../../auth/auth.service';
import {BoardsService} from '../../data/boards.service';
import {BoardStore} from '../../store/board-store.service';
import {CardsService} from "../../data/cards.service";
import {BoardCreateModalService} from "../../components/board-create-modal/board-create-modal.service";
import {CardCreateModalService} from "../../components/card-create-modal/card-create-modal.service";
import {BoardCreateModalComponent} from "../../components/board-create-modal/board-create-modal.component";

@Component({
    standalone: true,
    selector: 'user-header',
    imports: [CommonModule, FormsModule, RouterLink, BoardCreateModalComponent],
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
            z-index: 50;
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
        <header class="hdr w-full">
            <div class="mx-auto max-w-full px-4 py-2 flex items-center gap-3">
                <!-- Left: Logo -->
                <a class="flex items-center gap-2 font-semibold tracking-wide" [routerLink]="['/b','_auto']">
                    <span>ello</span><span class="pill">kanban</span>
                </a>

                <!-- Board switcher -->
                <div class="relative inline-flex items-center">
                    <select
                            class="select"
                            [ngModel]="store.currentBoardId()"
                            (ngModelChange)="onSwitch($event)">
                        <option *ngFor="let b of store.boards()" [value]="b.id">{{ b.name }}</option>
                    </select>
                    <svg class="pointer-events-none absolute right-2 h-4 w-4 opacity-90" viewBox="0 0 20 20"
                         fill="currentColor">
                        <path d="M5.25 7.5l4.5 4.5 4.5-4.5" stroke="currentColor" stroke-width="1.5" fill="none"
                              stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>

                <!-- Search -->
                <div class="ml-2 flex-1 max-w-[520px]">
                    <input
                            class="w-full rounded-md px-3 py-1.5 text-sm text-[#172b4d]"
                            placeholder="Search cards…"
                            [ngModel]="query()"
                            (ngModelChange)="query.set($event); onSearch()"/>
                </div>

                <!-- Right: quick actions -->
                <div class="ml-auto flex items-center gap-3">
                    <button class="btn" (click)="onAddCardClick()">+ Add card</button>
                    <button class="btn" (click)="onCreateBoardClick()">+ Create board</button>

                    <!-- Notifications -->
                    <button class="pill p-2" title="Notifications">
                        <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 006 14h12a1 1 0 00.707-1.707L18 11.586V8a6 6 0 00-6-6zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                        </svg>
                    </button>

                    <!-- User menu -->
                    <div class="menu" (focusout)="closeIfBlur($event)">
                        <button class="pill p-1.5 flex items-center gap-2" (click)="toggleMenu()">
                            <span class="avatar" *ngIf="!user()?.avatar">{{ initials() }}</span>
                            <img *ngIf="user()?.avatar" class="avatar" [src]="user()?.avatar" alt="">
                            <span class="hidden md:inline text-sm">{{ user()?.name || user()?.email }}</span>
                            <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.25 7.5l4.5 4.5 4.5-4.5"/>
                            </svg>
                        </button>

                        <div class="menu-content" *ngIf="menuOpen()">
                            <div class="px-2 py-1 text-xs text-gray-500">Account</div>
                            <div class="menu-item">{{ user()?.name || 'User' }}</div>
                            <div class="menu-item text-gray-600">{{ user()?.email }}</div>
                            <hr class="my-1">
                            <div class="menu-item" (click)="goProfile()">Profile & Settings</div>
                            <div class="menu-item" (click)="logout()">Log out</div>
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
    query = signal('');

    user = computed(() => this.auth.user());
    initials = () => (this.user()?.name || this.user()?.email || 'U').trim().slice(0, 2).toUpperCase();

    constructor() {
        effect(() => {
            this.auth.isAuthed();
            this.store.currentBoardId();
        });
    }

    toggleMenu() {
        this.menuOpen.update(v => !v);
    }

    closeIfBlur(ev: FocusEvent) {
        const next = ev.relatedTarget as HTMLElement | null;
        if (!next || !(ev.currentTarget as HTMLElement).contains(next)) this.menuOpen.set(false);
    }

    async onSwitch(id: string) {
        if (!id) return;
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
