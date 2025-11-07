import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { BoardStore } from './store/board-store.service';
import { BoardsService } from './data/boards.service';
import { ListsService } from './data/lists.service';
import {KanbanBoardComponent} from "./ui/kanban-board/kanban-board.component";
import {FormsModule} from "@angular/forms";

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, HttpClientModule, KanbanBoardComponent, FormsModule],
  template: `
    <header class="w-full bg-board-bg text-white">
      <div class="mx-auto max-w-full px-4 py-3 flex items-center gap-4">
        <div class="font-semibold tracking-wide">ello kanban</div>

        <select
            class="bg-white/20 text-white rounded px-3 py-1 text-sm"
            [ngModel]="store.currentBoardId()"
            (ngModelChange)="onSwitch($event)">
          <option *ngFor="let b of store.boards()" [value]="b.id">{{ b.name }}</option>
        </select>

        <button class="ml-auto bg-white text-ink-base rounded px-3 py-1 text-sm shadow"
                (click)="reload()">
          Reload
        </button>
      </div>
    </header>

    <main class="h-[calc(100vh-56px)] bg-[#0079bf] bg-cover bg-center overflow-auto">
      <kanban-board class="block"></kanban-board>
    </main>
  `
})
export class AppComponent implements OnInit {
  store = inject(BoardStore);
  boardsApi = inject(BoardsService);
  listsApi = inject(ListsService);

  async ngOnInit() {
    await this.boardsApi.loadBoards(); // sets boards + selects first + loads lists
  }

  async onSwitch(id: string) {
    if (id) await this.boardsApi.selectBoard(id); // also loads lists
  }

  reload() { this.boardsApi.loadBoards(); }
}
