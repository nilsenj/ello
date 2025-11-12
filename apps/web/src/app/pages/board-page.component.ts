import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { BoardStore } from '../store/board-store.service';
import { BoardsService } from '../data/boards.service';
import { ListsService } from '../data/lists.service';
import { KanbanBoardComponent } from '../ui/kanban-board/kanban-board.component';
import { CardModalComponent } from '../ui/card-modal/card-modal.component';
import { UserHeaderComponent } from '../ui/user-header/user-header.component';

@Component({
    standalone: true,
    selector: 'board-page',
    imports: [CommonModule, FormsModule, KanbanBoardComponent, CardModalComponent, UserHeaderComponent],
    template: `
        <user-header></user-header>

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

            const firstId = this.store.boards()[0]?.id;
            if (firstId) {
                await this.boardsApi.selectBoard(firstId);
                this.router.navigate(['/b', firstId], {
                    replaceUrl: true,
                    fragment: this.route.snapshot.fragment ?? undefined
                });
            }
        });
    }
}
