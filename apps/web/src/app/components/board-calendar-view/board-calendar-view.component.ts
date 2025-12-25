
import { Component, computed, inject, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { BoardStore } from '../../store/board-store.service';
import { Card } from '../../types';
import { CardModalService } from "../../ui/card-modal/card-modal.service";
import { CardCreateModalService } from "../../components/card-create-modal/card-create-modal.service";
import { CardsService } from '../../data/cards.service';

@Component({
    selector: 'board-calendar-view',
    standalone: true,
    imports: [CommonModule, DragDropModule],
    templateUrl: './board-calendar-view.component.html',
    styles: [`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        .cdk-drag-preview {
            box-sizing: border-box;
            border-radius: 4px;
            box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2),
                        0 8px 10px 1px rgba(0, 0, 0, 0.14),
                        0 3px 14px 2px rgba(0, 0, 0, 0.12);
        }
        .cdk-drag-placeholder { opacity: 0; }
        .cdk-drag-animating { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }
        .calendar-grid.cdk-drop-list-dragging .calendar-day:not(.cdk-drag-placeholder) { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }
    `]
})
export class BoardCalendarViewComponent {
    store = inject(BoardStore);
    modal = inject(CardModalService);
    createModal = inject(CardCreateModalService);
    cardsApi = inject(CardsService);

    readonly tToday = $localize`:@@boardCalendar.today:Today`;
    readonly tAddCard = $localize`:@@boardCalendar.addCard:Add card`;
    weekDays = [
        $localize`:@@boardCalendar.sun:Sun`,
        $localize`:@@boardCalendar.mon:Mon`,
        $localize`:@@boardCalendar.tue:Tue`,
        $localize`:@@boardCalendar.wed:Wed`,
        $localize`:@@boardCalendar.thu:Thu`,
        $localize`:@@boardCalendar.fri:Fri`,
        $localize`:@@boardCalendar.sat:Sat`,
    ];

    // Signals
    currentDate = signal(new Date());
    _cards = signal<Card[]>([]);
    @Input() canEdit = true;

    currentMonthName = computed(() => this.currentDate().toLocaleString('default', { month: 'long' }));
    currentYear = computed(() => this.currentDate().getFullYear());

    @Input() set cards(value: Card[]) {
        this._cards.set(value);
    }

    lists = this.store.lists;

    // Computed calendar days
    calendarDays = computed(() => {
        const now = this.currentDate();
        const year = now.getFullYear();
        const month = now.getMonth();
        // Dependence on _cards() ensures re-calc when cards update
        this._cards();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days: any[] = [];

        // Previous month padding
        const startPadding = firstDay.getDay();
        for (let i = startPadding - 1; i >= 0; i--) {
            const d = new Date(year, month, -i);
            days.push({
                date: d,
                isoDate: this.toIsoDate(d),
                isCurrentMonth: false,
                cards: this.getCardsForDate(d)
            });
        }

        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const d = new Date(year, month, i);
            const isToday = new Date().toDateString() === d.toDateString();
            days.push({
                date: d,
                isoDate: this.toIsoDate(d),
                isCurrentMonth: true,
                isToday,
                cards: this.getCardsForDate(d)
            });
        }

        // Next month padding to fill 6 rows (42 days)
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const d = new Date(year, month + 1, i);
            days.push({
                date: d,
                isoDate: this.toIsoDate(d),
                isCurrentMonth: false,
                cards: this.getCardsForDate(d)
            });
        }

        return days;
    });

    private toIsoDate(d: Date): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    prevMonth() {
        const d = this.currentDate();
        this.currentDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    }

    nextMonth() {
        const d = this.currentDate();
        this.currentDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    }

    today() {
        this.currentDate.set(new Date());
    }

    getCardsForDate(date: Date): Card[] {
        const dateStr = this.toIsoDate(date);
        return this._cards().filter(c => {
            const d = (c as any).dueDate;
            if (!d) return false;
            return d.startsWith(dateStr);
        });
    }

    getCardColor(card: Card): string {
        const labels = this.store.labels();
        if (card.labelIds?.length) {
            const l = labels.find(x => x.id === card.labelIds?.[0]);
            return l?.color || '#3b82f6';
        }
        return '#3b82f6';
    }

    openCard(card: Card, event?: Event) {
        if (event) event.stopPropagation();
        this.modal.open(card.id);
    }

    addCard(date: Date, event?: Event) {
        if (event) event.stopPropagation();
        if (!this.canEdit) return;
        // date is Local Midnight. We want to save it as UTC Midnight.
        // Convert to UTC-aligned date
        const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

        this.createModal.open({
            dueDate: utcDate,
        });
    }

    async drop(event: CdkDragDrop<any>) {
        if (!this.canEdit) return;
        if (event.previousContainer === event.container) {
            // Reordering within same day (no-op for calendar usually, as it's sorted by something or arbitrary)
            // But we could implement time sorting later. For now, do nothing.
            return;
        }

        // Moved to another day
        const card = event.item.data as Card;
        const newDateStr = event.container.id; // YYYY-MM-DD (Local)

        // We want to force this string to be interpreted as UTC date (e.g. 2023-10-27 -> 2023-10-27T00:00:00Z)
        // new Date('2023-10-27') is typically UTC, but to be safe:
        const parts = newDateStr.split('-').map(Number);
        const targetDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

        await this.cardsApi.patchCardExtended(card.id, { dueDate: targetDate.toISOString() });
    }
}
