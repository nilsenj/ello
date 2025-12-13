import { Injectable, signal } from '@angular/core';

export type CreateCardDefaults = {
    listId?: string;
    dueDate?: Date;
};

@Injectable({ providedIn: 'root' })
export class CardCreateModalService {
    readonly isOpen = signal(false);
    readonly defaults = signal<CreateCardDefaults>({});

    open(defaults: CreateCardDefaults = {}) {
        this.defaults.set(defaults);
        this.isOpen.set(true);
    }

    close() {
        this.isOpen.set(false);
        this.defaults.set({});
    }
}
