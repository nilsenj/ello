// apps/web/src/app/store/board-store.service.ts
import { Injectable, signal } from '@angular/core';
import type { Board, Card, Label, ListDto } from '../types';

@Injectable({ providedIn: 'root' })
export class BoardStore {
    private _boards = signal<Board[]>([]);
    private _currentBoardId = signal<string | null>(null);
    private _lists = signal<ListDto[]>([]);
    private _labels = signal<Label[]>([]);

    boards = this._boards.asReadonly();
    currentBoardId = this._currentBoardId.asReadonly();
    lists = this._lists.asReadonly();
    labels = this._labels.asReadonly();

    // --- setters (arrow funcs -> safe `this`) ---
    setBoards = (boards: Board[]) => this._boards.set(boards ?? []);
    setCurrentBoardId = (id: string | null) => this._currentBoardId.set(id ?? null);
    setLists = (lists: ListDto[]) => this._lists.set(lists ?? []);
    setLabels = (v: Label[]) => this._labels.set(v ?? []);

    // --- list ops ---
    renameListLocally = (listId: string, name: string) => {
        this._lists.update(arr => arr.map(l => l.id === listId ? { ...l, name, title: name } : l));
    };

    // --- card upsert / title / remove ---
    upsertCardLocally = (listId: string, card: Card) => {
        this._lists.update(arr =>
            arr.map(l => {
                if (l.id !== listId) return l;
                const cards = [...(l.cards ?? [])];
                const i = cards.findIndex(c => c.id === card.id);
                if (i === -1) cards.push(card);
                else cards[i] = { ...cards[i], ...card };
                return { ...l, cards };
            })
        );
    };

    patchCardTitleLocally = (cardId: string, title: string) => {
        this._lists.update(arr =>
            arr.map(l => ({
                ...l,
                cards: (l.cards ?? []).map(c => (c.id === cardId ? { ...c, title } : c)),
            }))
        );
    };

    removeCardLocally = (cardId: string) => {
        this._lists.update(arr =>
            arr.map(l => ({ ...l, cards: (l.cards ?? []).filter(c => c.id !== cardId) }))
        );
    };

    // --- labels (normalize to labelIds on the card for fast UI) ---
    private _extractLabelIds(card: any): string[] {
        if (!card) return [];
        if (Array.isArray(card.labelIds)) return card.labelIds.filter(Boolean);
        if (Array.isArray(card.labels)) {
            return card.labels.map((x: any) => (typeof x === 'string' ? x : x?.id ?? x?.labelId)).filter(Boolean);
        }
        if (Array.isArray(card.cardLabels)) {
            return card.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
        }
        return [];
    }

    setCardLabels = (cardId: string, labelIds: string[]) => {
        const uniq = Array.from(new Set(labelIds.filter(Boolean)));
        this._lists.update(arr =>
            arr.map(l => ({
                ...l,
                cards: (l.cards ?? []).map(c => (c.id === cardId ? { ...c, labelIds: uniq } : c)),
            }))
        );
    };

    addLabelToCardLocally = (cardId: string, labelId: string) => {
        this._lists.update(lists =>
            lists.map(l => ({
                ...l,
                cards: (l.cards ?? []).map(c => {
                    if (c.id !== cardId) return c;
                    const ids = new Set(this._extractLabelIds(c));
                    ids.add(labelId);
                    return { ...c, labelIds: Array.from(ids) };
                }),
            }))
        );
    };

    removeLabelFromCardLocally = (cardId: string, labelId: string) => {
        this._lists.update(lists =>
            lists.map(l => ({
                ...l,
                cards: (l.cards ?? []).map(c => {
                    if (c.id !== cardId) return c;
                    const ids = this._extractLabelIds(c).filter(id => id !== labelId);
                    return { ...c, labelIds: ids };
                }),
            }))
        );
    };

    // Back-compat aliases (some callers use these names)
    addLabelToCard = this.addLabelToCardLocally;
    removeLabelFromCard = this.removeLabelFromCardLocally;

    // (Optional) Junction-shape helpers kept for future needs
    private getLabelIds(card: Card | any): string[] { return this._extractLabelIds(card); }

    private patchLabelsShape(card: any, ids: string[]): Card {
        if (Array.isArray(card.labelIds)) return { ...card, labelIds: ids };
        if (Array.isArray(card.labels)) {
            const first = card.labels[0];
            if (typeof first === 'string') return { ...card, labels: ids };
            const byId = new Map(card.labels.map((o: any) => [o?.id ?? o?.labelId, o]));
            const nextObjs = ids.map(id => byId.get(id) ?? { id });
            return { ...card, labels: nextObjs };
        }
        if (Array.isArray(card.cardLabels)) {
            const byId = new Map(card.cardLabels.map((o: any) => [o?.labelId, o]));
            const nextJunctions = ids.map(id => byId.get(id) ?? { labelId: id, cardId: card.id });
            return { ...card, cardLabels: nextJunctions };
        }
        return { ...card, labelIds: ids };
    }
}
