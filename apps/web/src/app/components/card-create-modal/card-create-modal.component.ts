import { Component, HostListener, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    LucideAngularModule,
    XIcon, ListPlusIcon, ColumnsIcon
} from 'lucide-angular';

import { CardCreateModalService } from './card-create-modal.service';
import { BoardStore } from '../../store/board-store.service';
import { CardsService } from '../../data/cards.service';
import { WorkspacesService, WorkspaceLite } from '../../data/workspaces.service';
import { ListsService } from '../../data/lists.service';
import type { ListDto } from '../../types';

@Component({
    standalone: true,
    selector: 'card-create-modal',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    styleUrls: ['./card-create-modal.component.css'],
    templateUrl: './card-create-modal.component.html',
})
export class CardCreateModalComponent {
    // icons
    readonly XIcon = XIcon;
    readonly ListPlusIcon = ListPlusIcon;
    readonly ColumnsIcon = ColumnsIcon;
    readonly tTitle = $localize`:@@cardCreate.title:Create card`;
    readonly tCardTitle = $localize`:@@cardCreate.cardTitle:Card title`;
    readonly tCardTitlePlaceholder = $localize`:@@cardCreate.cardTitlePlaceholder:e.g., Write launch plan`;
    readonly tWorkspaceLabel = $localize`:@@cardCreate.workspaceLabel:Workspace`;
    readonly tWorkspacePlaceholder = $localize`:@@cardCreate.workspacePlaceholder:Select a workspace…`;
    readonly tBoardLabel = $localize`:@@cardCreate.boardLabel:Board`;
    readonly tBoardPlaceholder = $localize`:@@cardCreate.boardPlaceholder:Select a board…`;
    readonly tListLabel = $localize`:@@cardCreate.listLabel:List`;
    readonly tListPlaceholder = $localize`:@@cardCreate.listPlaceholder:Select a list…`;
    readonly tCancel = $localize`:@@cardCreate.cancel:Cancel`;
    readonly tCreate = $localize`:@@cardCreate.create:Create card`;
    readonly tCreating = $localize`:@@cardCreate.creating:Creating…`;

    // deps
    modal = inject(CardCreateModalService);
    store = inject(BoardStore);
    cardsApi = inject(CardsService);
    workspacesApi = inject(WorkspacesService);
    listsApi = inject(ListsService);

    // form state
    title = signal('');
    listId = signal<string | null>(null);
    adding = signal(false);
    workspaces = signal<WorkspaceLite[]>([]);
    selectedWorkspaceId = signal<string | null>(null);
    selectedBoardId = signal<string | null>(null);
    listOptions = signal<ListDto[]>([]);

    lists = computed(() => this.listOptions() ?? []);
    canSubmit = computed(() => (this.title().trim().length > 0) && !!this.listId());
    availableBoards = computed(() => {
        const wsId = this.selectedWorkspaceId();
        return this.store.boards().filter(b => !b.isArchived && (!wsId || b.workspaceId === wsId));
    });

    constructor() {
        // When modal opens: pick first list by default. When closes: reset.
        effect(() => {
            if (this.modal.isOpen()) {
                void this.loadWorkspaces();
                const defs = this.modal.defaults();
                const currentBoardId = this.store.currentBoardId();
                const currentBoard = currentBoardId
                    ? this.store.boards().find(b => b.id === currentBoardId)
                    : null;
                if (currentBoard) {
                    this.selectedWorkspaceId.set(currentBoard.workspaceId);
                    this.selectedBoardId.set(currentBoard.id);
                }
                void this.loadListsForBoard(this.selectedBoardId(), defs.listId);
            } else {
                // reset when closing so next open is clean
                this.title.set('');
                this.listId.set(null);
                this.adding.set(false);
                this.selectedWorkspaceId.set(null);
                this.selectedBoardId.set(null);
                this.listOptions.set([]);
            }
        }, { allowSignalWrites: true });
    }

    @HostListener('document:keydown.escape')
    onEsc() { if (this.modal.isOpen()) this.close(); }

    onBackdrop(e: MouseEvent) {
        if ((e.target as HTMLElement).classList.contains('cm-backdrop')) this.close();
    }

    openWithDefaults() {
        // pick first list by default if any
        const first = this.lists()[0];
        this.listId.set(first?.id ?? null);
    }

    async create() {
        if (!this.canSubmit() || this.adding()) return;
        this.adding.set(true);
        try {
            const created = await this.cardsApi.createCardInList(this.listId()!, this.title().trim());

            // Handle defaults (e.g. due date)
            const defs = this.modal.defaults();
            if (defs.dueDate) {
                await this.cardsApi.patchCardExtended(created.id, {
                    dueDate: defs.dueDate.toISOString()
                });
            }

            this.reset();
            this.close();
        } finally {
            this.adding.set(false);
        }
    }

    async loadWorkspaces() {
        try {
            const list = await this.workspacesApi.list();
            this.workspaces.set(list);
            if (!this.selectedWorkspaceId() && list.length) {
                this.selectedWorkspaceId.set(list[0].id);
            }
            if (!this.selectedBoardId()) {
                const firstBoard = this.availableBoards()[0];
                if (firstBoard) {
                    this.selectedBoardId.set(firstBoard.id);
                    void this.loadListsForBoard(firstBoard.id);
                }
            }
        } catch (err) {
            console.error('Failed to load workspaces', err);
        }
    }

    async onWorkspaceChange(id: string | null) {
        this.selectedWorkspaceId.set(id);
        const firstBoard = this.availableBoards()[0];
        this.selectedBoardId.set(firstBoard?.id ?? null);
        await this.loadListsForBoard(this.selectedBoardId());
    }

    async onBoardChange(id: string | null) {
        this.selectedBoardId.set(id);
        await this.loadListsForBoard(id);
    }

    async loadListsForBoard(boardId: string | null, preferredListId?: string) {
        if (!boardId) {
            this.listOptions.set([]);
            this.listId.set(null);
            return;
        }
        try {
            const lists = await this.listsApi.fetchLists(boardId);
            this.listOptions.set(lists);
            if (preferredListId && lists.some(l => l.id === preferredListId)) {
                this.listId.set(preferredListId);
            } else {
                this.listId.set(lists[0]?.id ?? null);
            }
        } catch (err) {
            console.error('Failed to load lists', err);
            this.listOptions.set([]);
            this.listId.set(null);
        }
    }

    close() { this.modal.close(); }
    private reset() { this.title.set(''); }
}
