import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { BoardStore } from '../store/board-store.service';
import { ListsService } from '../data/lists.service';
import { ListColumnComponent } from './list-column.component';

@Component({
    standalone: true,
    selector: 'board-view',
    imports: [CommonModule, CdkDropListGroup, ListColumnComponent, FormsModule],
    template: `
        <div class="min-h-full px-4 py-4">
            <div class="flex items-start gap-3">
                <div class="flex gap-3 overflow-x-auto pb-4">
                    <div cdkDropListGroup class="flex gap-3">
                        <list-column *ngFor="let l of lists()" [list]="l"></list-column>
                    </div>
                </div>

                <div class="w-[272px] shrink-0">
                    <ng-container *ngIf="!creatingList(); else editor">
                        <button
                                class="w-full text-left bg-white/20 hover:bg-white/30 text-white rounded-md px-3 py-2"
                                (click)="creatingList.set(true)">
                            + Add another list
                        </button>
                    </ng-container>
                    <ng-template #editor>
                        <div class="bg-list-bg rounded-md p-2 shadow-card">
                            <input
                                    class="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                    placeholder="Enter list title..."
                                    [(ngModel)]="newListTitle" />
                            <div class="mt-2 flex items-center gap-2">
                                <button class="bg-accent-blue text-white rounded px-3 py-1 text-sm"
                                        (click)="addList()">
                                    Add list
                                </button>
                                <button class="text-white/90" (click)="cancel()">✕</button>
                            </div>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `
})
export class BoardViewComponent implements OnInit {
    store = inject(BoardStore);
    listsApi = inject(ListsService);

    lists = computed(() => this.store.lists());
    creatingList = signal(false);
    newListTitle = '';

    async ngOnInit() {
        // lists are loaded via BoardsService.selectBoard → ListsService.loadLists
    }

    async addList() {
        const name = this.newListTitle.trim();
        if (!name) return;
        await this.listsApi.createList(name);
        this.newListTitle = '';
        this.creatingList.set(false);
    }

    cancel() { this.newListTitle = ''; this.creatingList.set(false); }
}
