import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ClockIcon, CalendarIcon, FileTextIcon } from 'lucide-angular';
import { CardsService } from '../../data/cards.service';
import { ClickOutsideDirective } from '../click-outside.directive';
import { Card } from '../../types';
import { BoardStore } from '../../store/board-store.service';
import { FormsModule } from '@angular/forms';
import { CardModalService } from '../card-modal/card-modal.service';
import { AuthService } from '../../auth/auth.service';
import { computed, inject } from '@angular/core';

@Component({
    standalone: true,
    selector: 'trello-card',
    imports: [CommonModule, ClickOutsideDirective, FormsModule, LucideAngularModule],
    templateUrl: './trello-card.component.html',
})
export class TrelloCardComponent {
    @Input({ required: true }) card!: Card;
    @Input({ required: true }) listId!: string;
    @Input() disableClick = false;

    showMore = false;
    editing = false;
    titleDraft = '';

    readonly ClockIcon = ClockIcon;
    readonly CalendarIcon = CalendarIcon;
    readonly FileTextIcon = FileTextIcon;
    readonly tCardAriaLabel = $localize`:@@trelloCard.cardAriaLabel:Card`;
    readonly tCoverAlt = $localize`:@@trelloCard.coverAlt:Cover`;
    readonly tMarkComplete = $localize`:@@trelloCard.markComplete:Mark complete`;
    readonly tCardTitlePlaceholder = $localize`:@@trelloCard.cardTitlePlaceholder:Card title...`;
    readonly tSave = $localize`:@@trelloCard.save:Save`;
    readonly tCancel = $localize`:@@trelloCard.cancel:Cancel`;
    readonly tPriorityTitle = (label: string) =>
        $localize`:@@trelloCard.priorityTitle:Priority: ${label}:priority:`;
    readonly tRiskTitle = (label: string) => $localize`:@@trelloCard.riskTitle:Risk: ${label}:risk:`;
    readonly tEstimationTitle = $localize`:@@trelloCard.estimationTitle:Estimation`;
    readonly tHasDescription = $localize`:@@trelloCard.hasDescription:Has description`;
    readonly tDescriptionShort = $localize`:@@trelloCard.descriptionShort:desc`;
    readonly tMoreMenuClose = $localize`:@@trelloCard.close:Close`;
    readonly tEditTitle = $localize`:@@trelloCard.editTitle:Edit title`;
    readonly tMove = $localize`:@@trelloCard.move:Move`;
    readonly tMoveTop = $localize`:@@trelloCard.moveTop:Move to top`;
    readonly tMoveUp = $localize`:@@trelloCard.moveUp:Move up`;
    readonly tMoveDown = $localize`:@@trelloCard.moveDown:Move down`;
    readonly tMoveBottom = $localize`:@@trelloCard.moveBottom:Move to bottom`;
    readonly tCopy = $localize`:@@trelloCard.copy:Copy`;
    readonly tArchive = $localize`:@@trelloCard.archive:Archive`;
    readonly tDelete = $localize`:@@trelloCard.delete:Delete`;
    readonly tOverdue = $localize`:@@trelloCard.overdue:overdue`;
    readonly tDueToday = $localize`:@@trelloCard.dueToday:due today`;
    readonly tDueInDays = (days: number) => $localize`:@@trelloCard.dueInDays:due in ${days}:days:d`;
    readonly tStarted = $localize`:@@trelloCard.started:started`;
    readonly tStartsSoon = $localize`:@@trelloCard.startsSoon:starts soon`;
    readonly tDueTitle = (date: string) => $localize`:@@trelloCard.dueTitle:Due ${date}:date:`;
    readonly tStartedTitle = (date: string) => $localize`:@@trelloCard.startedTitle:Started ${date}:date:`;
    readonly tStartsTitle = (date: string) => $localize`:@@trelloCard.startsTitle:Starts ${date}:date:`;
    readonly tPointsShort = $localize`:@@trelloCard.pointsShort:pt`;
    readonly tPriorityLow = $localize`:@@trelloCard.priorityLow:low`;
    readonly tPriorityMedium = $localize`:@@trelloCard.priorityMedium:medium`;
    readonly tPriorityHigh = $localize`:@@trelloCard.priorityHigh:high`;
    readonly tPriorityUrgent = $localize`:@@trelloCard.priorityUrgent:urgent`;
    readonly tRiskLow = $localize`:@@trelloCard.riskLow:low`;
    readonly tRiskMedium = $localize`:@@trelloCard.riskMedium:medium`;
    readonly tRiskHigh = $localize`:@@trelloCard.riskHigh:high`;
    readonly tDeleteConfirm = $localize`:@@trelloCard.deleteConfirm:Delete this card forever?`;
    readonly tCopyPrompt = $localize`:@@trelloCard.copyPrompt:Name for the copy:`;
    readonly tCopyAlert = $localize`:@@trelloCard.copyAlert:Card copied to bottom of list.`;

    auth = inject(AuthService);

    constructor(
        public store: BoardStore,
        public cardsApi: CardsService, // made public for use in template if needed
        private modal: CardModalService,
    ) { }

    canEdit = computed(() => {
        const uid = this.auth.user()?.id;
        if (!uid) return false;
        const members = this.store.members();
        const me = members.find(m => m.id === uid);
        return me?.role === 'owner' || me?.role === 'admin' || me?.role === 'member';
    });

    openModal(ev: MouseEvent) {
        if (this.disableClick) return;
        const target = ev.target as HTMLElement;
        if (target.closest('button, a, input, textarea, [data-stop-open]')) return;
        ev.stopPropagation();
        this.modal.open(this.card.id);
    }

    // -------- New helpers: priority / risk / estimation / due --------

    priority() {
        const val = (this.card as any)?.priority as string | undefined;
        if (!val) return null;
        // dot: left stripe color; border: card border color; bg/fg used by the badge you already show
        const map: Record<string, { label: string; dot: string; border: string; bg: string; fg: string }> = {
            low: { label: this.tPriorityLow, dot: '#22c55e', border: '#86efac', bg: 'rgba(34,197,94,0.12)', fg: '#14532d' },   // green-400/200
            medium: { label: this.tPriorityMedium, dot: '#eab308', border: '#fde047', bg: 'rgba(234,179,8,0.14)', fg: '#713f12' },   // amber-500/300
            high: { label: this.tPriorityHigh, dot: '#f97316', border: '#fdba74', bg: 'rgba(249,115,22,0.14)', fg: '#7c2d12' },   // orange-500/300
            urgent: { label: this.tPriorityUrgent, dot: '#ef4444', border: '#fca5a5', bg: 'rgba(239,68,68,0.14)', fg: '#7f1d1d' },   // red-500/300
        };
        return map[val] ?? null;
    }


    priorityClass() {
        // Tailwind needs explicit class names so we provide all variants.
        const val = (this.card as any)?.priority as 'low' | 'medium' | 'high' | 'urgent' | undefined;
        switch (val) {
            case 'low': return 'ring-1 ring-green-200';
            case 'medium': return 'ring-1 ring-amber-200';
            case 'high': return 'ring-1 ring-orange-200';
            case 'urgent': return 'ring-2 ring-red-300';
            default: return '';
        }
    }

    risk() {
        // values: 'low' | 'medium' | 'high'
        const val = (this.card as any)?.risk as string | undefined;
        if (!val) return null;
        const map: Record<string, { label: string; bg: string; fg: string }> = {
            low: { label: this.tRiskLow, bg: 'rgba(34,197,94,0.12)', fg: '#14532d' },
            medium: { label: this.tRiskMedium, bg: 'rgba(234,179,8,0.14)', fg: '#713f12' },
            high: { label: this.tRiskHigh, bg: 'rgba(239,68,68,0.14)', fg: '#7f1d1d' },
        };
        return map[val] ?? null;
    }

    estimation(): string | null {
        // server may send `estimation` alias; fallback to `estimate`
        const val = (this.card as any)?.estimation ?? (this.card as any)?.estimate;
        if (val === null || val === undefined) return null;
        return `${val}${this.tPointsShort}`;
    }

    dueInfo() {
        const dueIso = (this.card as any)?.dueDate as string | undefined | null;
        const startIso = (this.card as any)?.startDate as string | undefined | null;
        if (!dueIso && !startIso) return null;

        const now = Date.now();
        const toDate = (x?: string | null) => {
            if (!x) return null;
            const d = new Date(x);
            return isNaN(d.getTime()) ? null : d;
        };

        const due = toDate(dueIso);
        const start = toDate(startIso);

        if (due) {
            const diff = due.getTime() - now;
            const days = Math.ceil(diff / 86400000);
            if (diff < 0) {
                return { text: this.tOverdue, title: this.tDueTitle(due.toLocaleString()), class: 'bg-red-50 text-red-700 rounded-full' };
            }
            if (days === 0) {
                return { text: this.tDueToday, title: this.tDueTitle(due.toLocaleString()), class: 'bg-amber-50 text-amber-700 rounded-full' };
            }
            return { text: this.tDueInDays(days), title: this.tDueTitle(due.toLocaleString()), class: 'bg-sky-50 text-sky-700 rounded-full' };
        }

        // If only start exists
        if (start) {
            const started = start.getTime() <= now;
            return started
                ? { text: this.tStarted, title: this.tStartedTitle(start.toLocaleString()), class: 'bg-emerald-50 text-emerald-700 rounded-full' }
                : { text: this.tStartsSoon, title: this.tStartsTitle(start.toLocaleString()), class: 'bg-sky-50 text-sky-700 rounded-full' };
        }

        return null;
    }

    // ----- existing stuff (unchanged) -----

    startEdit() {
        this.titleDraft = this.card.title ?? '';
        this.editing = true;
        this.showMore = false;
    }
    cancelEdit() { this.editing = false; }
    async saveEdit() {
        const next = (this.titleDraft ?? '').trim();
        if (!next || next === this.card.title) { this.editing = false; return; }
        await this.cardsApi.updateCard(this.card.id, { title: next });
        this.store.patchCardTitleLocally?.(this.card.id, next);
        this.editing = false;
    }
    async delete() {
        if (!confirm(this.tDeleteConfirm)) return;
        await this.cardsApi.deleteCard(this.card.id);
        this.store.removeCardLocally?.(this.card.id);
        this.showMore = false;
    }

    async archive() {
        await this.cardsApi.patchCardExtended(this.card.id, { isArchived: true });
        // Update local view to archived (KanbanBoardComponent/ListColumnComponent will filter it out)
        this.store.upsertCardLocally(this.listId, { ...this.card, isArchived: true });
        this.showMore = false;
    }

    labelIds(card: Card): string[] {
        const any = card as any;
        if (Array.isArray(any.labelIds)) return any.labelIds.filter(Boolean);
        if (Array.isArray(any.labels)) return any.labels.map((x: any) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
        if (Array.isArray(any.cardLabels)) return any.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
        return [];
    }
    private getListCards() {
        const list = this.store.lists().find((l: { id: string }) => l.id === this.listId);
        return list ? (list.cards ?? []) : [];
    }
    private indexInList() { return this.getListCards().findIndex(c => c.id === this.card.id); }

    async moveTop() {
        const cards = this.getListCards();
        if (!cards.length) return;
        const beforeId = undefined;
        const afterId = cards[0]?.id === this.card.id ? cards[1]?.id : cards[0]?.id;
        await this.cardsApi.moveCard(this.card.id, this.listId, beforeId, afterId);
        const idx = this.indexInList();
        if (idx > 0) { cards.splice(idx, 1); cards.unshift(this.card); }
        this.showMore = false;
    }
    async moveBottom() {
        const cards = this.getListCards();
        if (!cards.length) return;
        const lastIdx = cards.length - 1;
        const beforeId = cards[lastIdx]?.id === this.card.id ? cards[lastIdx - 1]?.id : cards[lastIdx]?.id;
        const afterId = undefined;
        await this.cardsApi.moveCard(this.card.id, this.listId, beforeId, afterId);
        const idx = this.indexInList();
        if (idx > -1 && idx < cards.length - 1) { cards.splice(idx, 1); cards.push(this.card); }
        this.showMore = false;
    }
    async moveUp() {
        const cards = this.getListCards();
        const idx = this.indexInList();
        if (idx <= 0) return;
        const beforeId = cards[idx - 2]?.id;
        const afterId = cards[idx - 1]?.id;
        await this.cardsApi.moveCard(this.card.id, this.listId, beforeId, afterId);
        cards.splice(idx, 1);
        cards.splice(idx - 1, 0, this.card);
        this.showMore = false;
    }
    async moveDown() {
        const cards = this.getListCards();
        const idx = this.indexInList();
        if (idx === -1 || idx >= cards.length - 1) return;
        const beforeId = cards[idx + 1]?.id;
        const afterId = cards[idx + 2]?.id;
        await this.cardsApi.moveCard(this.card.id, this.listId, beforeId, afterId);
        cards.splice(idx, 1);
        cards.splice(idx + 1, 0, this.card);
        this.showMore = false;
    }

    async toggleDone(ev: MouseEvent) {
        ev.stopPropagation();
        const next = !this.cardDone();
        await this.cardsApi.patchCardExtended(this.card.id, { isDone: next });
        // local optimistic update
        (this.card as any).isDone = next;
    }

    async copy() {
        const title = prompt(this.tCopyPrompt, this.card.title + ' (copy)');
        if (!title) return;

        await this.cardsApi.copyCard(this.card.id, this.listId, title);
        this.showMore = false;
        alert(this.tCopyAlert);
    }

    cardDone(): boolean {
        // prefer `isDone` if present; fallback to `completed` for compatibility
        const any = this.card as any;
        return Boolean(any.isDone ?? any.completed ?? false);
    }

    labelColor = (id: string) => this.store.labels().find(l => l.id === id)?.color ?? '#ccc';
    labelName = (id: string) => this.store.labels().find(l => l.id === id)?.name ?? '';

    onEditKeydown($event: KeyboardEvent) {
        if ($event.key === 'Enter' && !$event.shiftKey) { $event.preventDefault(); this.saveEdit(); }
        if ($event.key === 'Escape') { $event.preventDefault(); this.cancelEdit(); }
    }
}
