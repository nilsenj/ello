// apps/web/src/app/pages/board-page.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { BoardStore } from '../store/board-store.service';
import { BoardsService } from '../data/boards.service';
import { ListsService } from '../data/lists.service';
import { KanbanBoardComponent } from '../ui/kanban-board/kanban-board.component';
import { CardModalComponent } from '../ui/card-modal/card-modal.component';

@Component({
    standalone: true,
    selector: 'board-page',
    imports: [CommonModule, FormsModule, KanbanBoardComponent, CardModalComponent],
    template: `
        <header class="w-full bg-board-bg text-white">
            <div class="mx-auto max-w-full px-4 py-3 flex items-center gap-4">
                <div class="font-semibold tracking-wide">ello kanban</div>

                <div class="relative inline-flex items-center">
                    <select
                            class="appearance-none bg-white/20 text-white rounded px-3 py-1 text-sm pr-7"
                            [ngModel]="store.currentBoardId()"
                            (ngModelChange)="onSwitch($event)">
                        <option *ngFor="let b of store.boards()" [value]="b.id">{{ b.name }}</option>
                    </select>
                    <svg class="pointer-events-none absolute right-2 h-4 w-4 opacity-80" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5.25 7.5l4.5 4.5 4.5-4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>

                <button class="ml-auto bg-white text-ink-base rounded px-3 py-1 text-sm shadow" (click)="reload()">Reload</button>
            </div>
        </header>

        <main class="h-[calc(100vh-56px)] bg-[#0079bf] bg-cover bg-center overflow-auto">
            <kanban-board class="block"></kanban-board>
            <card-modal></card-modal>
        </main>
    `
})
export class BoardPageComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    store = inject(BoardStore);
    boardsApi = inject(BoardsService);
    listsApi = inject(ListsService);

    async ngOnInit() {
        await this.boardsApi.loadBoards({ autoSelect: false });

        this.route.paramMap.subscribe(async params => {
            const id = params.get('boardId');

            if (id && id !== '_auto' && this.store.boards().some(b => b.id === id)) {
                await this.boardsApi.selectBoard(id);
                return;
            }

            // Fallback: pick first & normalize the path (keep current hash intact)
            const firstId = this.store.boards()[0]?.id;
            if (firstId) {
                await this.boardsApi.selectBoard(firstId);
                this.router.navigate(['/b', firstId], { replaceUrl: true, fragment: this.route.snapshot.fragment ?? undefined });
            }
        });
    }

    async onSwitch(id: string) {
        if (!id) return;
        // Path navigation only (no query params). Preserve hash if any.
        this.router.navigate(['/b', id], { replaceUrl: false, fragment: this.route.snapshot.fragment ?? undefined });
        await this.boardsApi.selectBoard(id);
    }

    reload() { this.boardsApi.loadBoards({ autoSelect: false }); }
}
