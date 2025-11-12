// apps/web/src/app/components/card-modal/card-modal.component.ts
import {Component, computed, effect, HostListener, inject, signal, untracked,} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import type {Checklist, CommentDto, ModalCard} from '../../types';
import {CardModalService} from './card-modal.service';
import {CardsService} from '../../data/cards.service';
import {BoardStore} from '../../store/board-store.service';
import {LabelsService} from '../../data/labels.service';
import {BoardsService} from '../../data/boards.service';
import {AttachmentDto, AttachmentsService} from '../../data/attachments.service';
import {SafeHtmlPipe} from '../../shared/safe-html.pipe';
import {
    BoldIcon,
    CalendarIcon,
    DownloadIcon,
    FileTextIcon,
    GaugeIcon,
    Heading1Icon,
    InfoIcon,
    ItalicIcon,
    LinkIcon,
    ListChecksIcon,
    ListIcon,
    LucideAngularModule,
    MessageSquareIcon,
    PaperclipIcon,
    PencilIcon,
    PlusIcon,
    PlusSquareIcon,
    SaveIcon,
    SendIcon,
    TagIcon,
    Trash2Icon,
    UsersIcon,
    XCircleIcon,
    XIcon,
} from 'lucide-angular';
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";

type PanelName = 'labels' | 'members' | 'dates' | 'checklists' | 'attachments' | 'planning';

@Component({
    standalone: true,
    selector: 'card-modal',
    imports: [CommonModule, FormsModule, LucideAngularModule, SafeHtmlPipe],
    styleUrls: ['./card-modal.component.css'],
    templateUrl: './card-modal.component.html',
})
export class CardModalComponent {
    // services/stores
    modal = inject(CardModalService);
    cardsApi = inject(CardsService);
    labelsApi = inject(LabelsService);
    boardsApi = inject(BoardsService);
    store = inject(BoardStore);
    attachmentsApi = inject(AttachmentsService);
    private sanitizer = inject(DomSanitizer);

    // ✔ expose icon refs for [img]
    readonly XIcon = XIcon;
    readonly InfoIcon = InfoIcon;
    readonly TagIcon = TagIcon;
    readonly CalendarIcon = CalendarIcon;
    readonly UsersIcon = UsersIcon;
    readonly ListChecksIcon = ListChecksIcon;
    readonly PaperclipIcon = PaperclipIcon;
    readonly GaugeIcon = GaugeIcon;
    readonly FileTextIcon = FileTextIcon;
    readonly PencilIcon = PencilIcon;
    readonly BoldIcon = BoldIcon;
    readonly ItalicIcon = ItalicIcon;
    readonly ListIcon = ListIcon;
    readonly Heading1Icon = Heading1Icon;
    readonly LinkIcon = LinkIcon;
    readonly MessageSquareIcon = MessageSquareIcon;
    readonly SendIcon = SendIcon;
    readonly Trash2Icon = Trash2Icon;
    readonly PlusIcon = PlusIcon;
    readonly PlusSquareIcon = PlusSquareIcon;
    readonly SaveIcon = SaveIcon;
    readonly XCircleIcon = XCircleIcon;

    // ui state
    loading = signal(false);
    data = signal<ModalCard | null>(null);

    // download state
    dlProgress = signal<Record<string, number>>({});
    dlBusy = signal<Set<string>>(new Set());
    dropActive = signal(false);

    isDownloading = (id: string) => this.dlBusy().has(id);
    downloadPercent = (id: string) => this.dlProgress()[id] ?? 0;

    // local form states
    titleDraft = signal('');
    descDraft = signal('');
    startDraft = signal<string | null>(null);
    dueDraft = signal<string | null>(null);
    commentDraft = signal('');
    priorityDraft = signal<'' | 'low' | 'medium' | 'high' | 'urgent'>('');
    riskDraft = signal<'' | 'low' | 'medium' | 'high'>('');
    estimationDraft = signal<string>('');

    attachments = signal<AttachmentDto[]>([]);
    attachUrlDraft = signal('');
    renameDraftId = signal<string | null>(null);
    renameDraftName = signal('');
    isUploading = signal(false);

    // side-panels state (single source of truth)
    private openPanelName = signal<PanelName | null>(null);
    private readonly reImg = /\.(png|jpe?g|gif|webp|bmp|svg)(?:\?.*)?$/i;
    private readonly reVid = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;
    private readonly reAud = /\.(mp3|wav|ogg|m4a|flac)(?:\?.*)?$/i;
    private readonly rePdf = /\.pdf(?:\?.*)?$/i;
    isPanelOpen = (name: PanelName) => this.openPanelName() === name;

    private isExt(url: string, re: RegExp) {
        try {
            return re.test(url);
        } catch {
            return false;
        }
    }

    isImage = (a: AttachmentDto) =>
        a.mime?.toLowerCase().startsWith('image/') || this.isExt(a.url, this.reImg);

    isVideo = (a: AttachmentDto) =>
        a.mime?.toLowerCase().startsWith('video/') || this.isExt(a.url, this.reVid);

    isAudio = (a: AttachmentDto) =>
        a.mime?.toLowerCase().startsWith('audio/') || this.isExt(a.url, this.reAud);

    isPdf = (a: AttachmentDto) =>
        a.mime?.toLowerCase() === 'application/pdf' || this.isExt(a.url, this.rePdf);

    coverUrl = computed(() => {
        const coverObj = this.attachments().find(a => a.isCover);
        if (!coverObj) return '';
        return this.attachmentApiFileUrl(coverObj as AttachmentDto);
    });

    safeMediaUrl(u: string | null | undefined): SafeResourceUrl {
        const url = (u ?? '').trim();
        // only trust http(s) and blob: (reject others like javascript:, data: by default)
        const ok = /^(https?:|blob:)/i.test(url);
        return this.sanitizer.bypassSecurityTrustResourceUrl(ok ? url : 'about:blank');
    }

    openPanel(name: PanelName, focusQuery?: string) {
        if (this.openPanelName() !== name) {
            this.openPanelName.set(name);
            if (focusQuery) {
                queueMicrotask(() =>
                    document.querySelector<HTMLInputElement>(focusQuery)?.focus()
                );
            }
        }
    }

    closePanel() {
        this.openPanelName.set(null);
    }

    togglePanel(name: PanelName) {
        this.openPanelName.set(this.isPanelOpen(name) ? null : name);
    }

    // Compact getters for current values (server value first, then draft)
    get currentPriority(): '' | 'low' | 'medium' | 'high' | 'urgent' {
        return (this.data()?.priority as any) ?? this.priorityDraft() ?? '';
    }

    get currentRisk(): '' | 'low' | 'medium' | 'high' {
        return (this.data()?.risk as any) ?? this.riskDraft() ?? '';
    }

    get currentEstimate(): number | '' {
        const server = (this.data() as any)?.estimate;
        if (typeof server === 'number') return server;
        const draft = this.estimationDraft().trim();
        return draft === '' ? '' : Number(draft);
    }

    // members cache
    members = signal<{ id: string; name: string; avatar?: string }[]>([]);

    private _labelsLoadedFor = new Set<string>();
    private _membersLoadedFor = new Set<string>();

    private reqToken = 0;
    trackId = (_: number, id: string) => id;

    constructor() {
        // EFFECT #1 — reacts to open/close + cardId
        effect(
            () => {
                const open = this.modal.isOpen();
                const id = this.modal.cardId();

                if (!open || !id) {
                    this.loading.set(false);
                    this.data.set(null);
                    this.titleDraft.set('');
                    this.descDraft.set('');
                    this.startDraft.set(null);
                    this.dueDraft.set(null);
                    this.commentDraft.set('');
                    this.priorityDraft.set('');
                    this.riskDraft.set('');
                    this.estimationDraft.set('');
                    this.openPanelName.set(null);
                    return;
                }

                const token = ++this.reqToken;
                this.loading.set(true);

                (async () => {
                    try {
                        const card = await this.cardsApi.getCard(id);
                        if (this.reqToken !== token) return;

                        const labelIds = this.normalizeLabelIds(card);
                        this.data.set({...card, labelIds} as any);

                        this.titleDraft.set(card?.title ?? '');
                        this.descDraft.set(card?.description ?? '');
                        this.startDraft.set(card?.startDate ? toLocalInput(card.startDate) : null);
                        this.dueDraft.set(card?.dueDate ? toLocalInput(card.dueDate) : null);

                        // planning fields
                        const priority = (card as any)?.priority ?? '';
                        const risk = (card as any)?.risk ?? '';
                        const estimate = (card as any)?.estimate;
                        this.priorityDraft.set(priority);
                        this.riskDraft.set(risk);
                        this.estimationDraft.set(
                            estimate === 0 || typeof estimate === 'number' ? String(estimate) : ''
                        );
                    } catch {
                        if (this.reqToken !== token) return;
                        this.data.set(null);
                    } finally {
                        if (this.reqToken === token) this.loading.set(false);
                    }
                })();

                (async () => {
                    try {
                        const list = await firstValueFrom(this.attachmentsApi.list(id));
                        this.attachments.set(list);
                    } catch {
                        this.attachments.set([]);
                    }
                })();
            },
            {allowSignalWrites: true}
        );

        // EFFECT #2 — load labels/members for board
        effect(
            () => {
                const boardId = this.store.currentBoardId();
                if (!boardId) return;
                untracked(() => {
                    if (!this._labelsLoadedFor.has(boardId)) {
                        this._labelsLoadedFor.add(boardId);
                        this.labelsApi.loadLabels(boardId).catch(() => {
                        });
                    }
                    if (!this._membersLoadedFor.has(boardId)) {
                        this._membersLoadedFor.add(boardId);
                        this.boardsApi
                            .getMembers(boardId)
                            .then((m) => this.members.set(m ?? []))
                            .catch(() => {
                            });
                    }
                });
            },
            {allowSignalWrites: true}
        );
    }

    // ------- Labels -------
    selectedLabelIds = computed(() => new Set(this.normalizeLabelIds(this.data())));

    hasLabel = (lid: string) => this.selectedLabelIds().has(lid);

    async toggleLabel(lid: string) {
        const c = this.data();
        if (!c) return;

        const has = this.selectedLabelIds().has(lid);
        try {
            if (has) {
                await this.labelsApi.unassignFromCard(c.id, lid);
                this.store.removeLabelFromCardLocally?.(c.id, lid);

                const next: any = {...c};
                if (Array.isArray((c as any).labelIds)) {
                    next.labelIds = this.normalizeLabelIds(c).filter((x) => x !== lid);
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
                await this.labelsApi.assignToCard(c.id, lid);
                this.store.addLabelToCardLocally?.(c.id, lid);

                const next: any = {...c};
                const ids = this.normalizeLabelIds(c);
                if (Array.isArray((c as any).labelIds)) {
                    next.labelIds = [...ids, lid];
                }
                if (Array.isArray((c as any).labels)) {
                    const sample = (c as any).labels[0];
                    if (typeof sample === 'string') {
                        next.labels = [...(c as any).labels, lid];
                    } else {
                        next.labels = [...(c as any).labels, {id: lid, labelId: lid}];
                    }
                }
                if (Array.isArray((c as any).cardLabels)) {
                    next.cardLabels = [...(c as any).cardLabels, {cardId: c.id, labelId: lid}];
                }
                this.data.set(next);
            }
        } catch {
            // noop (UI will re-sync on reopen)
        }
    }

    labelColor = (id: string) =>
        this.store.labels().find((l) => l.id === id)?.color ?? '#ccc';
    labelName = (id: string) =>
        this.store.labels().find((l) => l.id === id)?.name ?? '';

    // ------- Save fields -------
    private _savingTitle = false;

    async saveTitle() {
        if (this._savingTitle) return;
        const c = this.data();
        if (!c) return;
        const next = (this.titleDraft() ?? '').trim();
        if (!next || next === c.title) return;
        this._savingTitle = true;
        try {
            await this.cardsApi.updateCard(c.id, {title: next});
            this.store.patchCardTitleLocally?.(c.id, next);
            this.data.set({...c, title: next});
        } finally {
            this._savingTitle = false;
        }
    }

    // ------- Dates -------
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
    currentMemberIds(): string[] {
        const c: any = this.data();
        if (!c) return [];
        if (Array.isArray(c.assignees))
            return c.assignees.map((a: any) => a?.userId ?? a?.id).filter(Boolean);
        return [];
    }

    hasAnyMembers = () => this.currentMemberIds().length > 0;
    hasMember = (uid: string) => this.currentMemberIds().includes(uid);

    async toggleMember(uid: string) {
        const c = this.data();
        if (!c) return;
        if (this.hasMember(uid)) {
            await this.cardsApi.unassignMember(c.id, uid);
            const nextAssignees =
                (c as any).assignees?.filter((a: any) => (a?.userId ?? a?.id) !== uid) ?? [];
            this.data.set({...c, assignees: nextAssignees} as any);
        } else {
            await this.cardsApi.assignMember(c.id, uid);
            const member = this.members().find((m) => m.id === uid);
            const nextAssignees = [
                ...((c as any).assignees ?? []),
                {userId: uid, user: member},
            ] as any[];
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
        this.data.set({
            ...c,
            checklists: [...(((c as any).checklists as Checklist[]) ?? []), created],
        } as any);
    }

    async renameChecklist(cid: string, title: string) {
        const c = this.data();
        if (!c) return;
        await this.cardsApi.updateChecklist(cid, {title});
        const next = this.checklists().map((cl) => (cl.id === cid ? {...cl, title} : cl));
        this.data.set({...c, checklists: next} as any);
    }

    async addChecklistItem(cid: string) {
        const c = this.data();
        if (!c) return;
        const created = await this.cardsApi.addChecklistItem(cid, {text: 'New item'});
        const next = this.checklists().map((cl) =>
            cl.id === cid ? {...cl, items: [...cl.items, created]} : cl
        );
        this.data.set({...c, checklists: next} as any);
    }

    async toggleChecklistItem(cid: string, itemId: string, done: boolean) {
        const c = this.data();
        if (!c) return;
        await this.cardsApi.updateChecklistItem(itemId, {done});
        const next = this.checklists().map((cl) =>
            cl.id === cid
                ? {...cl, items: cl.items.map((it) => (it.id === itemId ? {...it, done} : it))}
                : cl
        );
        this.data.set({...c, checklists: next} as any);
    }

    // ------- Comments -------
    comments() {
        return (this.data()?.comments ?? []) as CommentDto[];
    }

    isCommentBlank() {
        return !this.commentDraft().trim();
    }

    async addComment() {
        const c = this.data();
        if (!c) return;
        const text = this.commentDraft().trim();
        if (!text) return;
        try {
            const created = await this.cardsApi.addComment(c.id, {text});
            if (!created) return;
            this.data.set({...c, comments: [...this.comments(), created]} as any);
            this.commentDraft.set('');
        } catch (err) {
            console.error('Failed to add comment', err);
        }
    }

    async deleteComment(commentId: string) {
        const c = this.data();
        if (!c) return;
        await this.cardsApi.deleteComment(commentId);
        this.data.set(
            {...c, comments: this.comments().filter((x) => x.id !== commentId)} as any
        );
    }

    // ------- Close -------
    close() {
        this.modal.close();
    }

    // ------- Planning -------
    async savePriority(val: '' | 'low' | 'medium' | 'high' | 'urgent') {
        const c = this.data();
        if (!c) return;
        this.priorityDraft.set(val);
        await this.cardsApi.patchCardExtended(
            c.id,
            val ? {priority: val} : ({priority: null} as any)
        );
        this.data.set({...c, priority: val || null} as any);
    }

    async saveRisk(val: '' | 'low' | 'medium' | 'high') {
        const c = this.data();
        if (!c) return;
        this.riskDraft.set(val);
        await this.cardsApi.patchCardExtended(
            c.id,
            val ? {risk: val} : ({risk: null} as any)
        );
        this.data.set({...c, risk: val || null} as any);
    }

    async saveEstimation(raw: unknown) {
        const c = this.data();
        if (!c) return;

        const s = (raw ?? '').toString();
        this.estimationDraft.set(s);

        const trimmed = s.trim();
        const n = trimmed === '' ? null : Number(trimmed);
        if (n !== null && (!Number.isFinite(n) || n < 0)) {
            // keep draft as-is, do not persist invalid value
            return;
        }

        await this.cardsApi.patchCardExtended(
            c.id,
            n === null ? ({estimate: null} as any) : {estimate: n}
        );
        this.data.set({...c, estimate: n} as any);
    }

    // ------- Priority styling -------
    private priorityPalette: Record<
        string,
        { label: string; dot: string; bg: string; fg: string; ring: string }
    > = {
        low: {label: 'Low', dot: '#22c55e', bg: 'rgba(34,197,94,0.12)', fg: '#14532d', ring: '#86efac'},
        medium: {label: 'Medium', dot: '#eab308', bg: 'rgba(234,179,8,0.14)', fg: '#713f12', ring: '#fde047'},
        high: {label: 'High', dot: '#f97316', bg: 'rgba(249,115,22,0.14)', fg: '#7c2d12', ring: '#fdba74'},
        urgent: {label: 'Urgent', dot: '#ef4444', bg: 'rgba(239,68,68,0.14)', fg: '#7f1d1d', ring: '#fca5a5'},
    };

    priorityMeta() {
        const raw = (this.data()?.priority as any) ?? this.priorityDraft();
        return raw ? this.priorityPalette[raw] ?? null : null;
    }

    priorityClass() {
        const p = (this.data()?.priority ?? this.priorityDraft()) || '';
        return p ? `pri-${p}` : '';
    }

    // ------- Description editor -------
    isEditingDesc = false;

    startDescEdit() {
        this.isEditingDesc = true;
    }

    cancelDescEdit() {
        const c = this.data();
        this.descDraft.set((c?.description ?? '') as string);
        this.isEditingDesc = false;
    }

    async saveDescription() {
        const c = this.data();
        if (!c) return;
        const next = (this.descDraft() ?? '').trim();
        await this.cardsApi.patchCardExtended(c.id, {description: next || ''});
        this.data.set({...c, description: next} as any);
        this.isEditingDesc = false;
    }

    wrapSelection(left: string, right: string) {
        const el = document.querySelector<HTMLTextAreaElement>('textarea.cm-textarea');
        if (!el) return;
        const {selectionStart: a, selectionEnd: b} = el;
        const val = this.descDraft() || '';
        const sel = val.slice(a, b);
        const next = val.slice(0, a) + left + sel + right + val.slice(b);
        this.descDraft.set(next);
        queueMicrotask(() => {
            el.focus();
            el.setSelectionRange(a + left.length, b + left.length);
        });
    }

    insertPrefix(prefix: string) {
        const el = document.querySelector<HTMLTextAreaElement>('textarea.cm-textarea');
        if (!el) return;
        const val = this.descDraft() || '';
        const {selectionStart: a, selectionEnd: b} = el;
        const before = val.slice(0, a);
        const blockStart = before.lastIndexOf('\n') + 1;
        const next = val.slice(0, blockStart) + prefix + val.slice(blockStart);
        this.descDraft.set(next);
        queueMicrotask(() => {
            el.focus();
            el.setSelectionRange(a + prefix.length, b + prefix.length);
        });
    }

    makeHeading() {
        this.insertPrefix('# ');
    }

    insertLink() {
        const el = document.querySelector<HTMLTextAreaElement>('textarea.cm-textarea');
        if (!el) return;
        const {selectionStart: a, selectionEnd: b} = el;
        const val = this.descDraft() || '';
        const sel = val.slice(a, b) || 'link text';
        const ins = `[${sel}](https://)`;
        const next = val.slice(0, a) + ins + val.slice(b);
        this.descDraft.set(next);
        queueMicrotask(() => {
            el.focus();
            const pos = a + ins.length - 1;
            el.setSelectionRange(pos, pos);
        });
    }

    // ------- Rich description (SSR-safe) -------
    private hasDom(): boolean {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    private fallbackSanitize(html: string): string {
        let out = html.replace(
            /<(script|style|iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi,
            ''
        );
        out = out
            .replace(/\son\w+="[^"]*"/gi, '')
            .replace(/\son\w+='[^']*'/gi, '')
            .replace(/\shref="javascript:[^"]*"/gi, ' href="#"')
            .replace(/\shref='javascript:[^']*'/gi, " href='#'");
        return out;
    }

    renderMarkdown(src: string | null | undefined): string {
        let s = (src ?? '').replace(/[&<>]/g, (m) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[m]!));
        // headings
        s = s.replace(/^\s*#{1,6}\s+(.*)$/gmi, '<h4>$1</h4>');
        // bold/italic
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/_(.+?)_/g, '<em>$1</em>');
        // links
        s = s.replace(
            /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener">$1</a>'
        );
        // simple lists (group contiguous items)
        s = s.replace(
            /(?:^|\n)(-\s+.*(?:\n-\s+.*)*)/g,
            (block) =>
                '<ul>' +
                block
                    .trim()
                    .split('\n')
                    .map((line) => line.replace(/^\-\s+(.+)$/, '<li>$1</li>'))
                    .join('') +
                '</ul>'
        );
        // paragraphs
        s = s
            .split(/\n{2,}/)
            .map((p) => (/^<(h4|ul)>/i.test(p) ? p : `<p>${p.replace(/\n/g, '<br/>')}</p>`))
            .join('\n');
        return s;
    }

    private looksLikeHtml(s: string): boolean {
        return /<([a-z][\w:-]*)(\s[^>]*)?>[\s\S]*<\/\1>|<([a-z][\w:-]*)(\s[^>]*)?\/>/i.test(s);
    }

    private sanitizeBasicHtml(input: string): string {
        if (!this.hasDom()) return this.fallbackSanitize(input);

        const allowedTags = new Set([
            'p',
            'br',
            'pre',
            'code',
            'blockquote',
            'hr',
            'ul',
            'ol',
            'li',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'strong',
            'b',
            'em',
            'i',
            'u',
            's',
            'a',
            'span',
            'div',
        ]);

        const allowedAttrs: Record<string, Set<string>> = {
            a: new Set(['href', 'title', 'target', 'rel']),
            span: new Set([]),
            div: new Set([]),
        };

        const template = document.createElement('template');
        template.innerHTML = input;

        const out = document.createElement('div');

        const cloneNode = (node: Node, parent: HTMLElement) => {
            if (node.nodeType === Node.TEXT_NODE) {
                parent.appendChild(document.createTextNode(node.textContent ?? ''));
                return;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const tag = el.tagName.toLowerCase();

                if (!allowedTags.has(tag)) {
                    for (const child of Array.from(el.childNodes)) cloneNode(child, parent);
                    return;
                }

                const outEl = document.createElement(tag);

                const allowed = allowedAttrs[tag] ?? new Set<string>();
                for (const {name, value} of Array.from(el.attributes)) {
                    const n = name.toLowerCase();
                    if (!allowed.has(n)) continue;

                    if (tag === 'a' && n === 'href') {
                        if (!/^(https?:|mailto:)/i.test(value)) continue;
                        outEl.setAttribute('href', value);
                        outEl.setAttribute('target', '_blank');
                        outEl.setAttribute('rel', 'noopener noreferrer');
                        continue;
                    }
                    outEl.setAttribute(n, value);
                }

                for (const child of Array.from(el.childNodes)) cloneNode(child, outEl);
                parent.appendChild(outEl);
            }
        };

        for (const child of Array.from(template.content.childNodes)) {
            cloneNode(child, out);
        }

        return out.innerHTML;
    }

    richDescription(src: string | null | undefined): string {
        const val = (src ?? '').trim();
        if (!val) return '';
        const html = this.looksLikeHtml(val) ? val : this.renderMarkdown(val);
        return this.sanitizeBasicHtml(html);
    }

    // ------- Labels helpers -------
    private normalizeLabelIds(src: any): string[] {
        const c = src as any;
        if (!c) return [];
        if (Array.isArray(c.labelIds)) return c.labelIds.filter(Boolean);
        if (Array.isArray(c.labels))
            return c.labels
                .map((x: any) => x?.labelId ?? (typeof x === 'string' ? x : x?.id))
                .filter(Boolean);
        if (Array.isArray(c.cardLabels))
            return c.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
        return [];
    }

    // ---- presence checks used to show/hide "Add to card" buttons ----
    hasLabels(): boolean {
        return this.selectedLabelIds().size > 0;
    }

    hasDates(): boolean {
        return !!(this.startDraft() || this.dueDraft());
    }

    hasMembers(): boolean {
        return this.currentMemberIds().length > 0;
    }

    hasChecklists(): boolean {
        return this.checklists().length > 0;
    }

    // hasAttachments(): boolean {
    //     const a = (this.data() as any)?.attachments;
    //     return Array.isArray(a) && a.length > 0;
    // }

    hasAttachments(): boolean {
        return (this.attachments()?.length ?? 0) > 0;
    }

    coverId(): string | null {
        return this.attachments().find(a => a.isCover)?.id ?? null;
    }

    hasPlanning(): boolean {
        const p = (this.data()?.priority as any) || this.priorityDraft() || '';
        const r = (this.data()?.risk as any) || this.riskDraft() || '';
        const e = (this.data() as any)?.estimate;
        const hasE = this.estimationDraft().trim() !== '' || (e !== null && e !== undefined);
        return !!(p || r || hasE);
    }


    async addAttachmentFile(input: HTMLInputElement) {
        const c = this.data();
        if (!c) return;
        const file = input.files?.[0];
        if (!file) return;
        this.isUploading.set(true);
        try {
            const created = await firstValueFrom(this.attachmentsApi.upload(c.id, file));
            this.attachments.set([created, ...this.attachments()]);
        } finally {
            this.isUploading.set(false);
            input.value = '';
        }
    }

    async addAttachmentByUrl() {
        const c = this.data();
        if (!c) return;
        const url = this.attachUrlDraft().trim();
        if (!url) return;
        try {
            const created = await firstValueFrom(this.attachmentsApi.attachUrl(c.id, url));
            this.attachments.set([created, ...this.attachments()]);
            this.attachUrlDraft.set('');
        } catch {
        }
    }

    startRename(a: AttachmentDto) {
        this.renameDraftId.set(a.id);
        this.renameDraftName.set(a.name ?? '');
    }

    cancelRename() {
        this.renameDraftId.set(null);
        this.renameDraftName.set('');
    }

    async saveRename() {
        const id = this.renameDraftId();
        if (!id) return;
        const name = this.renameDraftName().trim();
        if (!name) return;
        try {
            const updated = await firstValueFrom(this.attachmentsApi.rename(id, name));
            this.attachments.set(this.attachments().map(x => x.id === id ? updated : x));
            this.cancelRename();
        } catch {
        }
    }

    async setAsCover(id: string) {
        try {
            await firstValueFrom(this.attachmentsApi.setCover(id));
            const list = this.attachments().map(a => ({...a, isCover: a.id === id}));
            this.attachments.set(list);
        } catch {
        }
    }

    async removeAttachment(id: string) {
        try {
            await firstValueFrom(this.attachmentsApi.delete(id));
            this.attachments.set(this.attachments().filter(a => a.id !== id));
        } catch {
        }
    }

    humanBytes(n?: number | null) {
        if (!n || n < 0) return '—';
        const u = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0, v = n;
        while (v >= 1024 && i < u.length - 1) {
            v /= 1024;
            i++;
        }
        return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
    }

    private setBusy(id: string, busy: boolean) {
        const s = new Set(this.dlBusy());
        if (busy) s.add(id); else s.delete(id);
        this.dlBusy.set(s);
    }

    private setProgress(id: string, percent: number) {
        this.dlProgress.set({...this.dlProgress(), [id]: percent});
    }

    private saveBlob(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    /** Download attachment with progress (cookie-based auth works on same-origin) */
    async downloadAttachment(a: AttachmentDto) {
        const id = a.id;
        if (this.isDownloading(id)) return;

        this.setBusy(id, true);
        this.setProgress(id, 0);

        const sub = this.attachmentsApi
            // withCredentials true is safe; on same-origin it’s a no-op, on subdomain it ensures cookies go along
            .downloadWithProgress(id, {withCredentials: true})
            .subscribe({
                next: (evt) => {
                    if (evt.kind === 'progress') this.setProgress(id, evt.percent);
                    if (evt.kind === 'done') {
                        const fallback = a.name || 'attachment';
                        const name = (evt.filename && evt.filename.trim()) ? evt.filename : fallback;
                        this.saveBlob(evt.blob, name);
                        this.setProgress(id, 100);
                        this.setBusy(id, false);
                        sub.unsubscribe();
                    }
                },
                error: () => {
                    // reset on error
                    this.setBusy(id, false);
                    this.setProgress(id, 0);
                    sub.unsubscribe();
                },
            });
    }

    onDragOver(e: DragEvent) {
        e.preventDefault();
        this.dropActive.set(true);
    }

    onDragLeave(e: DragEvent) {
        e.preventDefault();
        this.dropActive.set(false);
    }

    async onDropFiles(e: DragEvent) {
        e.preventDefault();
        this.dropActive.set(false);
        const c = this.data();
        if (!c) return;
        const files = Array.from(e.dataTransfer?.files ?? []);
        if (!files.length) return;
        this.isUploading.set(true);
        try {
            // sequential to keep order + avoid overloading server; parallel if you wish
            for (const f of files) {
                const created = await firstValueFrom(this.attachmentsApi.upload(c.id, f));
                this.attachments.set([created, ...this.attachments()]);
            }
        } finally {
            this.isUploading.set(false);
        }
    }

// existing single input → accept multiple (backwards compatible)
    async addAttachmentFiles(input: HTMLInputElement) {
        const c = this.data();
        if (!c) return;
        const files = Array.from(input.files ?? []);
        if (!files.length) return;
        this.isUploading.set(true);
        try {
            for (const f of files) {
                const created = await firstValueFrom(this.attachmentsApi.upload(c.id, f));
                this.attachments.set([created, ...this.attachments()]);
            }
        } finally {
            this.isUploading.set(false);
            input.value = '';
        }
    }

// open in new tab (respects your proxy + cookie auth via GET in same origin)
    previewAttachment(a: AttachmentDto) {
        const url = this.attachmentApiFileUrl(a); // already exposed in template
        window.open(url, '_blank', 'noopener');
    }

// Small badge text like "PDF", "PNG", "ZIP"
    fileExt(a: AttachmentDto): string {
        const s = (a.name || a.url || '').split('?')[0];
        const ix = s.lastIndexOf('.');
        if (ix < 0) return 'FILE';
        return s.slice(ix + 1).toUpperCase().slice(0, 6);
    }

    // ------- Keyboard -------
    @HostListener('document:keydown.escape')
    onEsc() {
        if (this.modal.isOpen()) this.close();
    }

    protected readonly HTMLInputElement = HTMLInputElement;
    protected readonly attachmentApiFileUrl = this.attachmentsApi.makeAttachmentUrlFactory();

    protected readonly DownloadIcon = DownloadIcon;
}

// --- helpers (pure) ---
function toLocalInput(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}`;
}

function toUtcIso(local: string) {
    const d = new Date(local);
    // new Date(local) treats 'local' as local time; convert to UTC ISO
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}
