// apps/web/src/app/components/card-modal/card-modal.component.ts
import { Component, computed, effect, HostListener, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type { CardAssignee, Checklist, CommentDto, ModalCard, ListDto, Board } from '../../types';

import { CardsService } from '../../data/cards.service';
import { BoardStore } from '../../store/board-store.service';
import { LabelsService } from '../../data/labels.service';
import { BoardsService } from '../../data/boards.service';
import { ListsService } from '../../data/lists.service';
import { AuthService } from '../../auth/auth.service';
import { AttachmentDto, AttachmentsService } from '../../data/attachments.service';
import {
    ActivityIcon,
    ArchiveIcon,
    ArrowRightIcon,
    CopyIcon,
    BoldIcon,
    CalendarIcon,
    DownloadIcon,
    FileTextIcon,
    GaugeIcon,
    Heading1Icon,
    ItalicIcon,
    LinkIcon,
    ListChecksIcon,
    ListIcon,
    LucideAngularModule,
    PaperclipIcon,
    PencilIcon,
    PlusIcon,
    SaveIcon,
    SendIcon,
    TagIcon,
    Trash2Icon,
    UsersIcon,
    XCircleIcon,
    XIcon,
    MoveIcon,
    ChevronLeftIcon,
    CheckIcon,
    ExternalLinkIcon,
} from 'lucide-angular';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CardModalService, PanelName } from "./card-modal.service";
import { CardModalDescriptionComponent } from './card-modal-description.component';
import { CardModalCommentsComponent } from './card-modal-comments.component';
import { CardModalActivityComponent } from './card-modal-activity.component';
import { CardModalDetailsComponent } from './card-modal-details.component';
import { CardModalAddToCardComponent } from './card-modal-add-to-card.component';
import { CardModalActionsComponent } from './card-modal-actions.component';

@Component({
    standalone: true,
    selector: 'card-modal',
    imports: [
        CommonModule,
        FormsModule,
        LucideAngularModule,
        CardModalDescriptionComponent,
        CardModalCommentsComponent,
        CardModalActivityComponent,
        CardModalDetailsComponent,
        CardModalAddToCardComponent,
        CardModalActionsComponent,
    ],
    styleUrls: ['./card-modal.component.css'],
    templateUrl: './card-modal.component.html',
})
export class CardModalComponent {
    // services/stores
    modal = inject(CardModalService);
    cardsApi = inject(CardsService);
    labelsApi = inject(LabelsService);
    boardsApi = inject(BoardsService);
    listsApi = inject(ListsService);
    auth = inject(AuthService);
    store = inject(BoardStore);
    attachmentsApi = inject(AttachmentsService);
    private sanitizer = inject(DomSanitizer);

    // icons
    readonly MoveIcon = MoveIcon;
    readonly ChevronLeftIcon = ChevronLeftIcon;
    readonly CheckIcon = CheckIcon;

    readonly XIcon = XIcon;
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
    readonly SendIcon = SendIcon;
    readonly Trash2Icon = Trash2Icon;
    readonly PlusIcon = PlusIcon;
    readonly SaveIcon = SaveIcon;
    readonly XCircleIcon = XCircleIcon;
    readonly DownloadIcon = DownloadIcon;
    readonly ArchiveIcon = ArchiveIcon;
    readonly ActivityIcon = ActivityIcon;
    readonly ExternalLinkIcon = ExternalLinkIcon;
    readonly tClose = $localize`:@@cardModal.close:Close`;
    readonly tNone = $localize`:@@cardModal.none:none`;
    readonly tCardTitleAria = (priority: string) =>
        $localize`:@@cardModal.titleAria:Card title. Priority: ${priority}:priority:`;
    readonly tLoading = $localize`:@@cardModal.loading:Loading...`;
    readonly tChecklistDefault = $localize`:@@cardModal.checklistDefault:Checklist`;
    readonly tChecklistItemDefault = $localize`:@@cardModal.checklistItemDefault:New item`;
    readonly tDeleteChecklistConfirm = $localize`:@@cardModal.deleteChecklistConfirm:Delete this checklist?`;
    readonly tArchiveCardConfirm = $localize`:@@cardModal.archiveCardConfirm:Archive this card?`;
    readonly tUnknownSize = $localize`:@@cardModal.unknownSize:—`;
    readonly tActivityCardFallback = $localize`:@@cardModal.activity.cardFallback:this card`;
    readonly tActivityListFallback = $localize`:@@cardModal.activity.listFallback:a list`;


    readonly CopyIcon = CopyIcon; // Need to import this

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
    startDraft = signal<string | null>(null);
    dueDraft = signal<string | null>(null);
    priorityDraft = signal<'' | 'low' | 'medium' | 'high' | 'urgent'>('');
    riskDraft = signal<'' | 'low' | 'medium' | 'high'>('');
    estimationDraft = signal<string>('');

    attachments = signal<AttachmentDto[]>([]);
    attachUrlDraft = signal('');
    renameDraftId = signal<string | null>(null);
    renameDraftName = signal('');
    isUploading = signal(false);

    // activity
    activities = signal<any[]>([]);

    // Move / Copy state
    availableBoards = signal<Board[]>([]);
    targetBoardId = signal<string | null>(null);
    targetLists = signal<ListDto[]>([]);
    targetListId = signal<string | null>(null);
    targetPosition = signal<string>('bottom');
    copyTitle = signal('');
    isBusyAction = signal(false);

    private currentMemberRole = computed(() => {
        const uid = this.auth.user()?.id;
        if (!uid) return null;
        const members = this.store.members();
        const me = members.find(m => m.id === uid || m.userId === uid);
        return me?.role ?? null;
    });

    canEdit = computed(() => {
        const role = this.currentMemberRole();
        return role === 'owner' || role === 'admin' || role === 'member';
    });

    canAdmin = computed(() => {
        const role = this.currentMemberRole();
        return role === 'owner' || role === 'admin';
    });

    // side-panels
    private openPanelName = signal<PanelName | null>(null);
    isPanelOpen = (name: PanelName) => this.openPanelName() === name;

    // preview heuristics
    private readonly reImg = /\.(png|jpe?g|gif|webp|bmp|svg)(?:\?.*)?$/i;
    private readonly reVid = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;
    private readonly reAud = /\.(mp3|wav|ogg|m4a|flac)(?:\?.*)?$/i;
    private readonly rePdf = /\.pdf(?:\?.*)?$/i;

    private isExt(url: string, re: RegExp) {
        try {
            return re.test(url);
        } catch {
            return false;
        }
    }

    isImage = (a: AttachmentDto) => a.mime?.toLowerCase().startsWith('image/') || this.isExt(a.url, this.reImg);
    isVideo = (a: AttachmentDto) => a.mime?.toLowerCase().startsWith('video/') || this.isExt(a.url, this.reVid);
    isAudio = (a: AttachmentDto) => a.mime?.toLowerCase().startsWith('audio/') || this.isExt(a.url, this.reAud);
    isPdf = (a: AttachmentDto) => a.mime?.toLowerCase() === 'application/pdf' || this.isExt(a.url, this.rePdf);

    isExternal = (a: AttachmentDto): boolean => {
        const raw = a.url || '';
        return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || raw.startsWith('blob:');
    };


    safeMediaUrl = (u: string | null | undefined): SafeResourceUrl => {
        const url = (u ?? '').trim();
        return this.sanitizer.bypassSecurityTrustResourceUrl(/^(https?:|blob:|\/)/i.test(url) ? url : 'about:blank');
    };


    openPanel = (name: PanelName, focusQuery?: string) => {
        if (this.openPanelName() !== name) {
            this.openPanelName.set(name);
            if (focusQuery) queueMicrotask(() => document.querySelector<HTMLInputElement>(focusQuery)?.focus());
        }
    };

    closePanel = () => {
        this.openPanelName.set(null);
    };

    // derived values for chips
    get currentPriority() {
        return (this.data()?.priority as any) ?? this.priorityDraft() ?? '';
    }

    get currentRisk() {
        return (this.data()?.risk as any) ?? this.riskDraft() ?? '';
    }

    get currentEstimate(): number | '' {
        const server = (this.data() as any)?.estimate;
        if (typeof server === 'number') return server;
        const draft = this.estimationDraft().trim();
        return draft === '' ? '' : Number(draft);
    }

    // EFFECTS
    private _labelsLoadedFor = new Set<string>();
    private reqToken = 0;

    constructor() {
        // EFFECT #1 — reacts to open/close + cardId
        effect(() => {
            const open = this.modal.isOpen();
            const id = this.modal.cardId();

            if (!open || !id) {
                this.loading.set(false);
                this.data.set(null);
                this.titleDraft.set('');
                this.startDraft.set(null);
                this.dueDraft.set(null);
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
                    this.data.set({ ...card, labelIds } as any);

                    this.titleDraft.set(card?.title ?? '');
                    this.startDraft.set(card?.startDate ? toLocalInput(card.startDate) : null);
                    this.dueDraft.set(card?.dueDate ? toLocalInput(card.dueDate) : null);

                    const priority = (card as any)?.priority ?? '';
                    const risk = (card as any)?.risk ?? '';
                    const estimate = (card as any)?.estimate;
                    this.priorityDraft.set(priority);
                    this.riskDraft.set(risk);
                    this.estimationDraft.set(estimate === 0 || typeof estimate === 'number' ? String(estimate) : '');
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

            (async () => {
                try {
                    const acts = await this.cardsApi.getCardActivity(id);
                    this.activities.set(acts);
                } catch {
                    this.activities.set([]);
                }
            })();
        }, { allowSignalWrites: true });

        // EFFECT #2 — Sync initial panel from service (Deep Linking)
        effect(() => {
            const open = this.modal.isOpen();
            const init = this.modal.initialPanel();
            if (open && init) {
                this.openPanelName.set(init);
                // Scroll to the panel after a minimal delay to allow rendering
                setTimeout(() => {
                    const el = document.querySelector(`[data-panel="${init}"]`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }
        }, { allowSignalWrites: true });

        // EFFECT #2 — load labels per board (members logic removed; handled in members-panel)
        effect(() => {
            const boardId = this.store.currentBoardId();
            if (!boardId) return;
            untracked(() => {
                if (!this._labelsLoadedFor.has(boardId)) {
                    this._labelsLoadedFor.add(boardId);
                    this.labelsApi.loadLabels(boardId).catch(() => {
                    });
                }
            });
        }, { allowSignalWrites: true });
    }

    // ------- Labels -------
    selectedLabelIds = computed(() => new Set(this.normalizeLabelIds(this.data())));
    hasLabel = (lid: string) => this.selectedLabelIds().has(lid);

    toggleLabel = async (lid: string) => {
        const c = this.data();
        if (!c) return;
        const has = this.selectedLabelIds().has(lid);
        try {
            if (has) {
                await this.labelsApi.unassignFromCard(c.id, lid);
                this.store.removeLabelFromCardLocally?.(c.id, lid);
                const next: any = { ...c };
                if (Array.isArray((c as any).labelIds)) next.labelIds = this.normalizeLabelIds(c).filter(x => x !== lid);
                if (Array.isArray((c as any).labels))
                    next.labels = (c as any).labels.filter((x: any) => (x?.labelId ?? x?.id ?? x) !== lid);
                if (Array.isArray((c as any).cardLabels))
                    next.cardLabels = (c as any).cardLabels.filter((x: any) => x?.labelId !== lid);
                this.data.set(next);
            } else {
                await this.labelsApi.assignToCard(c.id, lid);
                this.store.addLabelToCardLocally?.(c.id, lid);
                const next: any = { ...c };
                const ids = this.normalizeLabelIds(c);
                if (Array.isArray((c as any).labelIds)) next.labelIds = [...ids, lid];
                if (Array.isArray((c as any).labels))
                    next.labels = [
                        ...(((c as any).labels ?? [])),
                        typeof (c as any).labels?.[0] === 'string' ? lid : { id: lid, labelId: lid },
                    ];
                if (Array.isArray((c as any).cardLabels))
                    next.cardLabels = [...(((c as any).cardLabels ?? [])), { cardId: c.id, labelId: lid }];
                this.data.set(next);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // --- Label Editor ---
    isEditingLabel = signal(false);
    labelDraftId = signal<string | null>(null); // null = creating new
    labelNameDraft = signal('');
    labelColorDraft = signal('#2196f3');

    // Trello-like colors
    readonly labelColors = [
        '#61bd4f', '#f2d600', '#ff9f1a', '#eb5a46', '#c377e0', '#0079bf', // green, yellow, orange, red, purple, blue
        '#00c2e0', '#51e898', '#ff78cb', '#344563'  // sky, lime, pink, dark
    ];

    startCreateLabel = () => {
        this.labelDraftId.set(null);
        this.labelNameDraft.set('');
        this.labelColorDraft.set(this.labelColors[0]);
        this.isEditingLabel.set(true);
    };

    startEditLabel = (label: { id: string, name: string, color: string }) => {
        this.labelDraftId.set(label.id);
        this.labelNameDraft.set(label.name);
        this.labelColorDraft.set(label.color);
        this.isEditingLabel.set(true);
    };

    cancelLabelEdit = () => {
        this.isEditingLabel.set(false);
        this.labelDraftId.set(null);
    };

    saveLabel = async () => {
        const boardId = this.store.currentBoardId();
        if (!boardId) return;
        const name = this.labelNameDraft().trim();
        const color = this.labelColorDraft();
        if (!name) return;

        try {
            if (this.labelDraftId()) {
                await this.labelsApi.renameLabel(this.labelDraftId()!, { name, color });
            } else {
                await this.labelsApi.createLabel(boardId, { name, color });
            }
            this.isEditingLabel.set(false);
        } catch (e) {
            console.error('Failed to save label', e);
        }
    };

    deleteLabel = async () => {
        const id = this.labelDraftId();
        if (!id) return;
        if (!confirm('Start deleting this label? There is no undo.')) return;
        try {
            await this.labelsApi.deleteLabel(id);
            this.isEditingLabel.set(false);
        } catch (e) {
            console.error('Failed to delete label', e);
        }
    };

    // ------- Save fields -------
    private _savingTitle = false;

    saveTitle = async () => {
        if (this._savingTitle) return;
        const c = this.data();
        if (!c) return;
        const next = (this.titleDraft() ?? '').trim();
        if (!next || next === c.title) return;
        this._savingTitle = true;
        try {
            await this.cardsApi.updateCard(c.id, { title: next });
            this.store.patchCardTitleLocally?.(c.id, next);
            this.data.set({ ...c, title: next });
        } finally {
            this._savingTitle = false;
        }
    };

    // ------- Dates -------
    setDates = async (kind: 'start' | 'due', val: string | null) => {
        const c = this.data();
        if (!c) return;
        const payload: any = {};
        if (kind === 'start') payload.startDate = val ? toUtcIso(val) : null;
        if (kind === 'due') payload.dueDate = val ? toUtcIso(val) : null;
        await this.cardsApi.patchCardExtended(c.id, payload);
        this.data.set({ ...c, ...payload });
    };

    // ------- Members (only minimal helpers kept) -------
    currentMemberIds(): string[] {
        const c: any = this.data();
        if (!c) return [];
        return Array.isArray(c.assignees) ? c.assignees.map((a: any) => a?.userId ?? a?.id).filter(Boolean) : [];
    }

    hasAnyMembers = () => this.currentMemberIds().length > 0;

    onAssigneesChange = (list: CardAssignee[]) => {
        this.data.update(c => (c ? ({ ...c, assignees: list } as ModalCard) : c));
    };

    // ------- Checklists -------
    checklists() {
        return (this.data()?.checklists ?? []) as Checklist[];
    }

    addChecklist = async () => {
        const c = this.data();
        if (!c) return;
        const created = await this.cardsApi.addChecklist(c.id, { title: this.tChecklistDefault });
        const checklistWithItems = { ...(created as object), items: [] };
        this.data.set({ ...c, checklists: [...((((c as any).checklists as Checklist[]) ?? [])), checklistWithItems] } as any);
    };

    renameChecklist = async (cid: string, title: string) => {
        const c = this.data();
        if (!c) return;
        await this.cardsApi.updateChecklist(cid, { title });
        const next = this.checklists().map(cl => (cl.id === cid ? { ...cl, title } : cl));
        this.data.set({ ...c, checklists: next } as any);
    };

    addChecklistItem = async (cid: string) => {
        const c = this.data();
        if (!c) return;
        const created = await this.cardsApi.addChecklistItem(cid, { text: this.tChecklistItemDefault });
        const next = this.checklists().map(cl => (cl.id === cid ? { ...cl, items: [...cl.items, created] } : cl));
        this.data.set({ ...c, checklists: next } as any);
    };

    toggleChecklistItem = async (cid: string, itemId: string, done: boolean) => {
        const c = this.data();
        if (!c) return;
        await this.cardsApi.updateChecklistItem(itemId, { done });
        const next = this.checklists().map(cl =>
            cl.id === cid ? { ...cl, items: cl.items.map(it => (it.id === itemId ? { ...it, done } : it)) } : cl
        );
        this.data.set({ ...c, checklists: next } as any);
    };

    updateChecklistItemText = async (cid: string, itemId: string, text: string) => {
        const c = this.data();
        if (!c) return;
        // Optimistic update could be good here, but for now just wait
        await this.cardsApi.updateChecklistItem(itemId, { text });
        const next = this.checklists().map(cl =>
            cl.id === cid ? { ...cl, items: cl.items.map(it => (it.id === itemId ? { ...it, text } : it)) } : cl
        );
        this.data.set({ ...c, checklists: next } as any);
    };

    deleteChecklistItem = async (cid: string, itemId: string) => {
        const c = this.data();
        if (!c) return;
        await this.cardsApi.deleteChecklistItem(itemId);
        const next = this.checklists().map(cl =>
            cl.id === cid ? { ...cl, items: cl.items.filter(it => it.id !== itemId) } : cl
        );
        this.data.set({ ...c, checklists: next } as any);
    };

    deleteChecklist = async (cid: string) => {
        const c = this.data();
        if (!c) return;
        if (!confirm(this.tDeleteChecklistConfirm)) return;
        await this.cardsApi.deleteChecklist(cid);
        const next = this.checklists().filter(cl => cl.id !== cid);
        this.data.set({ ...c, checklists: next } as any);
    };

    // ------- Comments -------
    comments() {
        return (this.data()?.comments ?? []) as CommentDto[];
    }

    onCommentsUpdated = (next: CommentDto[]) => {
        this.data.update(c => (c ? ({ ...c, comments: next } as ModalCard) : c));
        void this.refreshActivities();
    };

    onDescriptionSaved = (next: string) => {
        this.data.update(c => (c ? ({ ...c, description: next } as ModalCard) : c));
        void this.refreshActivities();
    };

    // ------- Close -------
    close() {
        this.modal.close();
    }

    // ------- Planning -------
    savePriority = async (val: '' | 'low' | 'medium' | 'high' | 'urgent') => {
        const c = this.data();
        if (!c) return;
        this.priorityDraft.set(val);
        await this.cardsApi.patchCardExtended(c.id, val ? { priority: val } : ({ priority: null } as any));
        this.data.set({ ...c, priority: val || null } as any);
    };

    saveRisk = async (val: '' | 'low' | 'medium' | 'high') => {
        const c = this.data();
        if (!c) return;
        this.riskDraft.set(val);
        await this.cardsApi.patchCardExtended(c.id, val ? { risk: val } : ({ risk: null } as any));
        this.data.set({ ...c, risk: val || null } as any);
    };

    saveEstimation = async (raw: unknown) => {
        const c = this.data();
        if (!c) return;
        const s = (raw ?? '').toString();
        this.estimationDraft.set(s);
        const trimmed = s.trim();
        const n = trimmed === '' ? null : Number(trimmed);
        if (n !== null && (!Number.isFinite(n) || n < 0)) return;
        await this.cardsApi.patchCardExtended(c.id, n === null ? ({ estimate: null } as any) : { estimate: n });
        this.data.set({ ...c, estimate: n } as any);
    };

    priorityClass() {
        const p = (this.data()?.priority ?? this.priorityDraft()) || '';
        return p ? `pri-${p}` : '';
    }

    // ------- Labels helpers / presence checks -------
    private normalizeLabelIds(src: any): string[] {
        const c = src as any;
        if (!c) return [];
        if (Array.isArray(c.labelIds)) return c.labelIds.filter(Boolean);
        if (Array.isArray(c.labels))
            return c.labels.map((x: any) => x?.labelId ?? (typeof x === 'string' ? x : x?.id)).filter(Boolean);
        if (Array.isArray(c.cardLabels)) return c.cardLabels.map((x: any) => x?.labelId).filter(Boolean);
        return [];
    }

    hasLabels() {
        return this.selectedLabelIds().size > 0;
    }

    hasDates() {
        return !!(this.startDraft() || this.dueDraft());
    }

    hasMembers() {
        return this.currentMemberIds().length > 0;
    }

    hasChecklists() {
        return this.checklists().length > 0;
    }

    hasAttachments() {
        return (this.attachments()?.length ?? 0) > 0;
    }

    coverId() {
        return this.attachments().find(a => a.isCover)?.id ?? null;
    }

    hasPlanning() {
        const p = (this.data()?.priority as any) || this.priorityDraft() || '';
        const r = (this.data()?.risk as any) || this.riskDraft() || '';
        const e = (this.data() as any)?.estimate;
        const hasE = this.estimationDraft().trim() !== '' || (e !== null && e !== undefined);
        return !!(p || r || hasE);
    }

    // ------- Attachments -------
    addAttachmentByUrl = async () => {
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
    };

    startRename = (a: AttachmentDto) => {
        this.renameDraftId.set(a.id);
        this.renameDraftName.set(a.name ?? '');
    };

    cancelRename = () => {
        this.renameDraftId.set(null);
        this.renameDraftName.set('');
    };

    saveRename = async () => {
        const id = this.renameDraftId();
        if (!id) return;
        const name = this.renameDraftName().trim();
        if (!name) return;
        try {
            const updated = await firstValueFrom(this.attachmentsApi.rename(id, name));
            this.attachments.set(this.attachments().map(x => (x.id === id ? updated : x)));
            this.cancelRename();
        } catch {
        }
    };

    setAsCover = async (id: string) => {
        try {
            await firstValueFrom(this.attachmentsApi.setCover(id));
            this.attachments.set(this.attachments().map(a => ({ ...a, isCover: a.id === id })));
            // Update local card data to reflect cover change immediately if needed
            const c = this.data();
            if (c) {
                const cover = this.attachments().find(a => a.id === id);
                // We might need to update the store or trigger a refresh, but for now local state is key
            }
        } catch {
        }
    };

    removeCover = async (id: string) => {
        try {
            // If there's an API for removing cover (e.g. setting it to null or unsetting), use it.
            // Assuming setCover(id) sets it, maybe we need an unset endpoint or just set another?
            // Actually, usually 'setCover' toggles or we need a specific 'removeCover'.
            // Let's check attachmentsApi.
            await firstValueFrom(this.attachmentsApi.removeCover(id));
            this.attachments.set(this.attachments().map(a => ({ ...a, isCover: false })));
        } catch {
        }
    };

    removeAttachment = async (id: string) => {
        try {
            await firstValueFrom(this.attachmentsApi.delete(id));
            this.attachments.set(this.attachments().filter(a => a.id !== id));
        } catch {
        }
    };

    /** Returns short upper-cased file extension (max 6 chars). */
    fileExt = (a: Pick<AttachmentDto, 'name' | 'url'> | { name?: string | null; url?: string | null }): string => {
        const s = ((a?.name || a?.url) ?? '').split('?')[0];
        const ix = s.lastIndexOf('.');
        return ix < 0 ? 'FILE' : s.slice(ix + 1).toUpperCase().slice(0, 6);
    };

    /** Opens the attachment URL in a new tab (used by template previews). */
    previewAttachment = (a: AttachmentDto): void => {
        const url = this.attachmentApiFileUrl(a); // factory created earlier
        if (url) window.open(url, '_blank', 'noopener');
    };

    // Drag & drop visual state
    onDragOver = (e: DragEvent) => {
        e.preventDefault();
        this.dropActive.set(true);
    };

    onDragLeave = (e: DragEvent) => {
        e.preventDefault();
        this.dropActive.set(false);
    };

    onDropFiles = async (e: DragEvent) => {
        e.preventDefault();
        this.dropActive.set(false);

        const c = this.data();
        if (!c) return;

        const files = Array.from(e.dataTransfer?.files ?? []);
        if (!files.length) return;

        this.isUploading.set(true);
        try {
            for (const f of files) {
                const created = await firstValueFrom(this.attachmentsApi.upload(c.id, f));
                this.attachments.set([created, ...this.attachments()]);
            }
        } finally {
            this.isUploading.set(false);
        }
    };

    // ------- Actions -------
    archiveCard = async () => {
        const c = this.data();
        if (!c) return;
        if (!confirm(this.tArchiveCardConfirm)) return;
        try {
            await this.cardsApi.archiveCard(c.id);
            this.store.upsertCardLocally(c.listId, { ...c, isArchived: true });
            this.close();
        } catch (err) {
            console.error('Failed to archive card', err);
        }
    };

    deleteCard = () => {
        this.openPanel('delete');
    };

    doDelete = async () => {
        const c = this.data();
        if (!c) return;
        this.isBusyAction.set(true);
        try {
            await this.cardsApi.deleteCard(c.id);
            this.store.removeCardLocally(c.id);
            this.close();
        } catch (err) {
            console.error('Failed to delete card', err);
        } finally {
            this.isBusyAction.set(false);
        }
    };



    // ------- Move / Copy Actions -------
    prepareMoveOrCopy = async (type: 'move' | 'copy') => {
        const c = this.data();
        if (c) {
            this.copyTitle.set(c.title);
        }
        this.openPanel(type);
        this.isBusyAction.set(true);
        try {
            // Load boards if not loaded
            if (this.availableBoards().length === 0) {
                await this.boardsApi.loadBoards();
                this.availableBoards.set(this.store.boards());
            }

            const currentBoardId = this.store.currentBoardId();

            this.targetBoardId.set(currentBoardId);

            if (currentBoardId) {
                await this.loadTargetLists(currentBoardId);
                // Try to find current list
                const found = this.targetLists().find(l => l.cards?.some(x => x.id === c?.id));
                if (found) {
                    this.targetListId.set(found.id);
                } else if (this.targetLists().length > 0) {
                    this.targetListId.set(this.targetLists()[0].id);
                }
            }
        } finally {
            this.isBusyAction.set(false);
        }
    };

    onTargetBoardChange = async (boardId: string) => {
        this.targetBoardId.set(boardId);
        this.isBusyAction.set(true);
        try {
            await this.loadTargetLists(boardId);
        } finally {
            this.isBusyAction.set(false);
        }
    };

    async loadTargetLists(boardId: string) {
        // Use the new side-effect-free fetch
        const lists = await this.listsApi.fetchLists(boardId);
        this.targetLists.set(lists);
        if (lists.length > 0) {
            this.targetListId.set(lists[0].id);
        } else {
            this.targetListId.set(null);
        }
    }

    doMove = async () => {
        const c = this.data();
        const bid = this.targetBoardId();
        const lid = this.targetListId();
        if (!c || !bid || !lid) return;

        this.isBusyAction.set(true);
        try {
            // Logic for position
            // For now simplified to 'top' or 'bottom'. 
            // If we want exact position we need more logic.
            // CardsService.moveCard(id, toListId, before?, after?)

            let beforeId: string | undefined;
            let afterId: string | undefined;

            const targetList = this.targetLists().find(l => l.id === lid);
            const cards = targetList?.cards || [];

            if (this.targetPosition() === 'top') {
                if (cards.length > 0) {
                    afterId = cards[0].id;
                }
            } else {
                // bottom
                // no before/after needed usually means append
            }

            await this.cardsApi.moveCard(c.id, lid, beforeId, afterId);

            // If moved to another board, close modal
            if (bid !== this.store.currentBoardId()) {
                this.close();
                // Remove from local store
                this.store.removeCardLocally(c.id);
            } else {
                // Same board, close panel, update local data
                this.closePanel();
                this.store.removeCardLocally(c.id);
                this.store.upsertCardLocally(lid, { ...c, listId: lid });
                await this.refreshActivities();
            }
        } catch (e) {
            console.error(e);
        } finally {
            this.isBusyAction.set(false);
        }
    };

    doCopy = async () => {
        const c = this.data();
        const bid = this.targetBoardId();
        const lid = this.targetListId();
        const title = this.copyTitle().trim();

        if (!c || !bid || !lid || !title) return;

        this.isBusyAction.set(true);
        try {
            const created = await this.cardsApi.copyCard(c.id, lid, title);
            // Update local board store so the new card appears immediately
            try {
                this.store.upsertCardLocally?.(lid, { id: created?.id ?? '', title, listId: lid } as any);
            } catch {
                // ignore store errors but keep UI responsive
            }
            // If copied to same board, we might want to see it? 
            // Surface copy in UI for immediate feedback
            this.closePanel();
        } catch (e) {
            console.error(e);
        } finally {
            this.isBusyAction.set(false);
        }
    };

    // --- activity format ---
    refreshActivities = async () => {
        const id = this.modal.cardId();
        if (!id) return;
        try {
            const acts = await this.cardsApi.getCardActivity(id);
            this.activities.set(acts);
        } catch {
            this.activities.set([]);
        }
    };

    // ------- Activity Helper -------
    formatActivity = (act: any) => {
        switch (act.type) {
            case 'create_card': {
                const listName = act.payload?.listName || this.tActivityListFallback;
                return $localize`:@@cardModal.activity.createCard:added this card to ${listName}:listName:`;
            }
            case 'update_description':
                return $localize`:@@cardModal.activity.updateDescription:changed the description of this card`;
            case 'move_card': {
                const fromList = act.payload?.fromList || this.tActivityListFallback;
                const toList = act.payload?.toList || this.tActivityListFallback;
                return $localize`:@@cardModal.activity.moveCard:moved this card from ${fromList}:fromList: to ${toList}:toList:`;
            }
            case 'comment_card':
                return $localize`:@@cardModal.activity.commentCard:commented on this card`;
            case 'archive_card':
                return $localize`:@@cardModal.activity.archiveCard:archived this card`;
            case 'restore_card':
                return $localize`:@@cardModal.activity.restoreCard:restored this card`;
            case 'card_completion':
                return act.payload?.isDone
                    ? $localize`:@@cardModal.activity.cardComplete:marked this card as complete`
                    : $localize`:@@cardModal.activity.cardIncomplete:marked this card as incomplete`;
            default:
                return $localize`:@@cardModal.activity.performed:performed ${act.type}:action:`;
        }
    };

    // File input handler
    addAttachmentFiles = async (input: HTMLInputElement) => {
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
    };

    humanBytes = (n?: number | null) => {
        if (!n || n < 0) return this.tUnknownSize;
        const u = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0,
            v = n;
        while (v >= 1024 && i < u.length - 1) {
            v /= 1024;
            i++;
        }
        return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
    };

    private setBusy(id: string, busy: boolean) {
        const s = new Set(this.dlBusy());
        busy ? s.add(id) : s.delete(id);
        this.dlBusy.set(s);
    }

    private setProgress(id: string, percent: number) {
        this.dlProgress.set({ ...this.dlProgress(), [id]: percent });
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

    downloadAttachment = async (a: AttachmentDto) => {
        const id = a.id;
        if (this.isDownloading(id)) return;
        this.setBusy(id, true);
        this.setProgress(id, 0);
        const sub = this.attachmentsApi.downloadWithProgress(id, { withCredentials: true }).subscribe({
            next: evt => {
                if (evt.kind === 'progress') this.setProgress(id, evt.percent);
                if (evt.kind === 'done') {
                    const fallback = a.name || 'attachment';
                    const name = evt.filename && evt.filename.trim() ? evt.filename : fallback;
                    this.saveBlob(evt.blob, name);
                    this.setProgress(id, 100);
                    this.setBusy(id, false);
                    sub.unsubscribe();
                }
            },
            error: () => {
                this.setBusy(id, false);
                this.setProgress(id, 0);
                sub.unsubscribe();
            },
        });
    };

    // keyboard
    @HostListener('document:keydown.escape') onEsc() {
        if (this.modal.isOpen()) this.close();
    }

    // template helpers
    protected readonly attachmentApiFileUrl = this.attachmentsApi.makeAttachmentUrlFactory();
}

// helpers
function toLocalInput(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toUtcIso(local: string) {
    const d = new Date(local);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}
