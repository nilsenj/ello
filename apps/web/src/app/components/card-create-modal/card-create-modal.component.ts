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

    // deps
    modal = inject(CardCreateModalService);
    store = inject(BoardStore);
    cardsApi = inject(CardsService);

    // form state
    title = signal('');
    listId = signal<string | null>(null);
    adding = signal(false);

    lists = computed(() => this.store.lists() ?? []);
    canSubmit = computed(() => (this.title().trim().length > 0) && !!this.listId());

    constructor() {
        // When modal opens: pick first list by default. When closes: reset.
        effect(() => {
            if (this.modal.isOpen()) {
                const defs = this.modal.defaults();
                if (defs.listId) {
                    this.listId.set(defs.listId);
                } else if (!this.listId()) {
                    const first = this.lists()[0];
                    if (first) this.listId.set(first.id);
                }
            } else {
                // reset when closing so next open is clean
                this.title.set('');
                this.listId.set(null);
                this.adding.set(false);
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

    close() { this.modal.close(); }
    private reset() { this.title.set(''); }
}
