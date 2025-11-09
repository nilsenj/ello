// apps/web/src/app/components/card-modal/card-modal.component.ts
import {Component, effect, HostListener, inject, signal, untracked, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import type {Checklist, CommentDto, ModalCard} from '../../types';
import {CardModalService} from './card-modal.service';
import {CardsService} from '../../data/cards.service';
import {BoardStore} from '../../store/board-store.service';
import {LabelsService} from '../../data/labels.service';
import {BoardsService} from "../../data/boards.service";

@Component({
    standalone: true,
    selector: 'card-modal',
    imports: [CommonModule, FormsModule],
    styleUrls: ['./card-modal.component.css'],
    templateUrl: './card-modal.component.html',
})
export class CardModalComponent {
    // services/stores
    modal = inject(CardModalService);
    cardsApi = inject(CardsService);
    labelsApi = inject(LabelsService);
    boardsApi = inject(BoardsService); // +++
    store = inject(BoardStore);

    // ui state
    loading = signal(false);
    data = signal<ModalCard | null>(null);

    // local form states
    titleDraft = signal('');
    descDraft = signal('');
    startDraft = signal<string | null>(null); // +++
    dueDraft = signal<string | null>(null); // +++
    commentDraft = signal('');                // +++
    isCommentBlank() { return !this.commentDraft().trim(); }

    // members/checklists cached for faster UI
    members = signal<{ id: string; name: string; avatar?: string }[]>([]); // board members
    // we’ll read checklists directly from `data()`; provide helpers below

    private _labelsLoadedFor = new Set<string>();
    private _membersLoadedFor = new Set<string>();

    get labelIds(): string[] {
        const c: any = this.data?.();
        if (!c) return [];
        if (Array.isArray(c.labelIds)) return c.labelIds.filter(Boolean);
        if (Array.isArray(c.labels)) return c.labels.map((x: any) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
        if (Array.isArray(c.cardLabels)) return c.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
        return [];
    }

    private reqToken = 0;
    trackId = (_: number, id: string) => id;

    constructor() {
        // EFFECT #1 — only reacts to open/close + cardId
        effect(() => {
            const open = this.modal.isOpen();
            const id = this.modal.cardId();

            // reset when closed or no id
            if (!open || !id) {
                this.loading.set(false);
                this.data.set(null);
                this.titleDraft.set('');
                this.descDraft.set('');
                this.startDraft.set(null);
                this.dueDraft.set(null);
                this.commentDraft.set('');
                return;
            }

            // fetch one card (no labels/members here!)
            const token = ++this.reqToken;
            this.loading.set(true);

            (async () => {
                try {
                    const card = await this.cardsApi.getCard(id);
                    if (this.reqToken !== token) return;

                    // normalize so the template has labelIds immediately
                    const labelIds = this.normalizeLabelIds(card);
                    this.data.set({ ...card, labelIds } as any);
                    this.titleDraft.set(card?.title ?? '');
                    this.descDraft.set(card?.description ?? '');
                    this.startDraft.set(card?.startDate ? toLocalInput(card.startDate) : null);
                    this.dueDraft.set(card?.dueDate ? toLocalInput(card.dueDate) : null);
                } catch {
                    if (this.reqToken !== token) return;
                    this.data.set(null);
                } finally {
                    if (this.reqToken === token) this.loading.set(false);
                }
            })();
        }, {allowSignalWrites: true});

        // EFFECT #2 — only reacts to board change; de-track preload results
        effect(() => {
            const boardId = this.store.currentBoardId();
            if (!boardId) return;

            // prevent this effect from re-running because members()/labels() change
            untracked(() => {
                if (!this._labelsLoadedFor.has(boardId)) {
                    this._labelsLoadedFor.add(boardId);
                    this.labelsApi.loadLabels(boardId).catch(() => {
                    });
                }
                if (!this._membersLoadedFor.has(boardId)) {
                    this._membersLoadedFor.add(boardId);
                    this.boardsApi.getMembers(boardId)
                        .then(m => this.members.set(m ?? []))
                        .catch(() => {
                        });
                }
            });
        }, {allowSignalWrites: true});
    }

    selectedLabelIds = computed(() => new Set(this.normalizeLabelIds(this.data())));

    // ------- Labels (unchanged) -------
    private currentLabelIds(): string[] {
        const c: any = this.data();
        if (!c) return [];
        if (Array.isArray(c.labelIds)) return c.labelIds.filter(Boolean);
        if (Array.isArray(c.labels))   return c.labels.map((x: any) => x?.labelId ?? (typeof x === 'string' ? x : x?.id)).filter(Boolean);
        if (Array.isArray(c.cardLabels)) return c.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
        return [];
    }

    hasLabel = (lid: string) => this.selectedLabelIds().has(lid);

    // ---- replace your toggleLabel with this ----
    async toggleLabel(lid: string) {
        const c = this.data();
        if (!c) return;

        const has = this.selectedLabelIds().has(lid);
        try {
            if (has) {
                // server first
                await this.labelsApi.unassignFromCard(c.id, lid);
                this.store.removeLabelFromCardLocally?.(c.id, lid);

                // optimistic client state for all supported shapes
                const next: any = { ...c };
                if (Array.isArray((c as any).labelIds)) {
                    next.labelIds = this.normalizeLabelIds(c).filter(x => x !== lid);
                }
                if (Array.isArray((c as any).labels)) {
                    next.labels = (c as any).labels.filter((x: any) => {
                        const id = x?.labelId ?? (typeof x === 'string' ? x : x?.id);
                        return id !== lid;
                    });
                }
                if (Array.isArray((c as any).cardLabels)) {
                    next.cardLabels = (c as any).cardLabels.filter((x: any) => x?.labelId !== lid);
                }
                this.data.set(next);
            } else {
                // server first
                await this.labelsApi.assignToCard(c.id, lid);
                this.store.addLabelToCardLocally?.(c.id, lid);

                // optimistic client state for all supported shapes
                const next: any = { ...c };
                const ids = this.normalizeLabelIds(c);
                if (Array.isArray((c as any).labelIds)) {
                    next.labelIds = [...ids, lid];
                }
                if (Array.isArray((c as any).labels)) {
                    // support either string ids or {id}/{labelId} objects
                    const sample = (c as any).labels[0];
                    if (typeof sample === 'string') {
                        next.labels = [ ...(c as any).labels, lid ];
                    } else {
                        // CardLabel or Label-like object – include a minimal stub
                        next.labels = [ ...(c as any).labels, { id: lid, labelId: lid } ];
                    }
                }
                if (Array.isArray((c as any).cardLabels)) {
                    next.cardLabels = [ ...(c as any).cardLabels, { cardId: c.id, labelId: lid } ];
                }
                this.data.set(next);
            }
        } catch (e) {
            // optional: toast/log – server is source of truth; UI will resync on reopen
        }
    }

    labelColor = (id: string) => this.store.labels().find(l => l.id === id)?.color ?? '#ccc';
    labelName = (id: string) => this.store.labels().find(l => l.id === id)?.name ?? '';

    // ------- Save fields -------
    async saveTitle() {
        const c = this.data();
        if (!c) return;
        const next = (this.titleDraft() ?? '').trim();
        if (!next || next === c.title) return;
        await this.cardsApi.updateCard(c.id, {title: next});
        this.store.patchCardTitleLocally?.(c.id, next);
        this.data.set({...c, title: next});
    }

    async saveDescription() {
        const c = this.data();
        if (!c) return;
        const next = (this.descDraft() ?? '').trim();
        await this.cardsApi.patchCardExtended(c.id, {description: next || ''});
        this.data.set({...c, description: next});
    }

    // ------- Dates (start & due) -------
    async setDates(kind: 'start' | 'due', val: string | null) {
        const c = this.data();
        if (!c) return;
        const payload: any = {};
        if (kind === 'start') payload.startDate = val ? toUtcIso(val) : null;
        if (kind === 'due') payload.dueDate = val ? toUtcIso(val) : null;
        await this.cardsApi.patchCardExtended(c.id, payload);
        this.data.set({...c, ...payload});
    }

    // ------- Members -------
    private currentMemberIds(): string[] {
        const c: any = this.data();
        if (!c) return [];
        if (Array.isArray(c.assignees)) return c.assignees.map((a: any) => a?.userId ?? a?.id).filter(Boolean);
        return [];
    }

    hasMember = (uid: string) => this.currentMemberIds().includes(uid);

    async toggleMember(uid: string) {
        const c = this.data();
        if (!c) return;
        if (this.hasMember(uid)) {
            await this.cardsApi.unassignMember(c.id, uid);
            const nextAssignees = (c as any).assignees?.filter((a: any) => (a?.userId ?? a?.id) !== uid) ?? [];
            this.data.set({...c, assignees: nextAssignees} as any);
        } else {
            await this.cardsApi.assignMember(c.id, uid);
            const member = this.members().find(m => m.id === uid);
            const nextAssignees = ([...(c as any).assignees ?? [], {userId: uid, user: member}] as any[]);
            this.data.set({...c, assignees: nextAssignees} as any);
        }
    }

    // ------- Checklists -------
    checklists() {
        return (this.data()?.checklists ?? []) as Checklist[];
    }

    async addChecklist() {
        const c = this.data();
        if (!c) return;
        const created = await this.cardsApi.addChecklist(c.id, {title: 'Checklist'});
        this.data.set({...c, checklists: [...(c as any).checklists ?? [], created]} as any);
    }

    async renameChecklist(cid: string, title: string) {
        const c = this.data();
        if (!c) return;
        await this.cardsApi.updateChecklist(cid, {title});
        const next = this.checklists().map(cl => cl.id === cid ? {...cl, title} : cl);
        this.data.set({...c, checklists: next} as any);
    }

    async addChecklistItem(cid: string) {
        const c = this.data();
        if (!c) return;
        const created = await this.cardsApi.addChecklistItem(cid, {text: 'New item'});
        const next = this.checklists().map(cl => cl.id === cid ? {...cl, items: [...cl.items, created]} : cl);
        this.data.set({...c, checklists: next} as any);
    }

    async toggleChecklistItem(cid: string, itemId: string, done: boolean) {
        const c = this.data();
        if (!c) return;
        await this.cardsApi.updateChecklistItem(itemId, {done});
        const next = this.checklists().map(cl =>
            cl.id === cid ? {...cl, items: cl.items.map(it => it.id === itemId ? {...it, done} : it)} : cl);
        this.data.set({...c, checklists: next} as any);
    }

    // ------- Comments -------
    comments() {
        return (this.data()?.comments ?? []) as CommentDto[];
    }

    async addComment() {
        const c = this.data(); if (!c) return;
        const text = this.commentDraft().trim();
        if (!text) return;

        try {
            const created = await this.cardsApi.addComment(c.id, { text });
            if (!created) return; // server must return the created comment

            this.data.set({ ...c, comments: [...this.comments(), created] } as any);
            this.commentDraft.set('');
        } catch (err) {
            // You can toast/log the error:
            console.error('Failed to add comment', err);
        }
    }

    async deleteComment(commentId: string) {
        const c = this.data();
        if (!c) return;
        await this.cardsApi.deleteComment(commentId);
        this.data.set({...c, comments: this.comments().filter(x => x.id !== commentId)} as any);
    }

    // ------- Close -------
    close() {
        this.modal.close();
    }

    private normalizeLabelIds(src: any): string[] {
        const c = src as any;
        if (!c) return [];
        if (Array.isArray(c.labelIds))   return c.labelIds.filter(Boolean);
        if (Array.isArray(c.labels))     return c.labels
            .map((x: any) => x?.labelId ?? (typeof x === 'string' ? x : x?.id))
            .filter(Boolean);
        if (Array.isArray(c.cardLabels)) return c.cardLabels
            .map((x: any) => x?.labelId)
            .filter(Boolean);
        return [];
    }

    @HostListener('document:keydown.escape') onEsc() {
        if (this.modal.isOpen()) this.close();
    }

    protected readonly Array = Array;
}

// --- helpers ---
function toLocalInput(iso: string) {
    // Convert ISO → "yyyy-MM-ddTHH:mm" (local)
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toUtcIso(local: string) {
    // treat input as local time and convert to ISO (UTC)
    const d = new Date(local);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}