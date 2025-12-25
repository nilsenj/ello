import { Component, Input, Signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SafeResourceUrl } from '@angular/platform-browser';

import type { CardAssignee, Checklist, Label, ModalCard } from '../../types';
import type { AttachmentDto } from '../../data/attachments.service';
import type { PanelName } from './card-modal.service';

import { MembersPanelComponent } from '../../components/members-panel/members-panel.component';
import { FilterByPipe } from '../../shared/filter-by.pipe';

@Component({
    standalone: true,
    selector: 'card-modal-add-to-card',
    imports: [CommonModule, FormsModule, LucideAngularModule, MembersPanelComponent, FilterByPipe],
    templateUrl: './card-modal-add-to-card.component.html',
    styleUrls: ['./card-modal.component.css'],
})
export class CardModalAddToCardComponent {
    readonly tAddToCard = $localize`:@@cardModalAddToCard.addToCard:Add to card`;
    readonly tLabels = $localize`:@@cardModalAddToCard.labels:Labels`;
    readonly tMembers = $localize`:@@cardModalAddToCard.members:Members`;
    readonly tDates = $localize`:@@cardModalAddToCard.dates:Dates`;
    readonly tChecklist = $localize`:@@cardModalAddToCard.checklist:Checklist`;
    readonly tAttachment = $localize`:@@cardModalAddToCard.attachment:Attachment`;
    readonly tPlanning = $localize`:@@cardModalAddToCard.planning:Planning`;
    readonly tViewOnly = $localize`:@@cardModalAddToCard.viewOnly:View-only access. Ask a board admin to add you as a member to edit.`;
    readonly tClose = $localize`:@@cardModalAddToCard.close:Close`;
    readonly tEditLabel = $localize`:@@cardModalAddToCard.editLabel:Edit label`;
    readonly tCreateLabel = $localize`:@@cardModalAddToCard.createLabel:Create label`;
    readonly tCreateNewLabel = $localize`:@@cardModalAddToCard.createNewLabel:Create a new label`;
    readonly tName = $localize`:@@cardModalAddToCard.name:Name`;
    readonly tLabelNamePlaceholder = $localize`:@@cardModalAddToCard.labelNamePlaceholder:Label name`;
    readonly tSelectColor = $localize`:@@cardModalAddToCard.selectColor:Select a color`;
    readonly tSave = $localize`:@@cardModalAddToCard.save:Save`;
    readonly tCreate = $localize`:@@cardModalAddToCard.create:Create`;
    readonly tDelete = $localize`:@@cardModalAddToCard.delete:Delete`;
    readonly tStart = $localize`:@@cardModalAddToCard.start:Start`;
    readonly tDue = $localize`:@@cardModalAddToCard.due:Due`;
    readonly tChecklists = $localize`:@@cardModalAddToCard.checklists:Checklists`;
    readonly tDeleteChecklist = $localize`:@@cardModalAddToCard.deleteChecklist:Delete checklist`;
    readonly tDeleteItem = $localize`:@@cardModalAddToCard.deleteItem:Delete item`;
    readonly tAddItem = $localize`:@@cardModalAddToCard.addItem:Add item`;
    readonly tAddChecklist = $localize`:@@cardModalAddToCard.addChecklist:Add checklist`;
    readonly tAttachments = $localize`:@@cardModalAddToCard.attachments:Attachments`;
    readonly tUploadFiles = $localize`:@@cardModalAddToCard.uploadFiles:Upload files`;
    readonly tDropFilesHere = $localize`:@@cardModalAddToCard.dropFilesHere:or drop them here`;
    readonly tFileTypesHint = $localize`:@@cardModalAddToCard.fileTypesHint:PNG, JPG, PDF, DOCX, ZIP...`;
    readonly tChooseFiles = $localize`:@@cardModalAddToCard.chooseFiles:Choose files`;
    readonly tAttachUrl = $localize`:@@cardModalAddToCard.attachUrl:Attach URL`;
    readonly tUploading = $localize`:@@cardModalAddToCard.uploading:Uploading...`;
    readonly tCover = $localize`:@@cardModalAddToCard.cover:Cover`;
    readonly tOpen = $localize`:@@cardModalAddToCard.open:Open`;
    readonly tMakeCover = $localize`:@@cardModalAddToCard.makeCover:Make Cover`;
    readonly tRemoveCover = $localize`:@@cardModalAddToCard.removeCover:Remove Cover`;
    readonly tVisit = $localize`:@@cardModalAddToCard.visit:Visit`;
    readonly tDownload = $localize`:@@cardModalAddToCard.download:Download`;
    readonly tRename = $localize`:@@cardModalAddToCard.rename:Rename`;
    readonly tAttachmentFallback = $localize`:@@cardModalAddToCard.attachmentFallback:attachment`;
    readonly tFileFallback = $localize`:@@cardModalAddToCard.fileFallback:file`;
    readonly tNoAttachments = $localize`:@@cardModalAddToCard.noAttachments:No attachments yet.`;
    readonly tNoAttachmentsHint = $localize`:@@cardModalAddToCard.noAttachmentsHint:Upload files or attach a URL to get started.`;
    readonly tPriority = $localize`:@@cardModalAddToCard.priority:Priority`;
    readonly tRisk = $localize`:@@cardModalAddToCard.risk:Risk`;
    readonly tEstimation = $localize`:@@cardModalAddToCard.estimation:Estimation`;
    readonly tEstimationPlaceholder = $localize`:@@cardModalAddToCard.estimationPlaceholder:e.g. 3`;
    readonly tNone = $localize`:@@cardModalAddToCard.none:None`;
    readonly tLow = $localize`:@@cardModalAddToCard.low:Low`;
    readonly tMedium = $localize`:@@cardModalAddToCard.medium:Medium`;
    readonly tHigh = $localize`:@@cardModalAddToCard.high:High`;
    readonly tUrgent = $localize`:@@cardModalAddToCard.urgent:Urgent`;
    readonly tStoryPoints = $localize`:@@cardModalAddToCard.storyPoints:Story Points`;
    readonly tUploadAria = $localize`:@@cardModalAddToCard.uploadAria:Upload files. You can also drag and drop.`;
    readonly tAttachUrlPlaceholder = $localize`:@@cardModalAddToCard.attachUrlPlaceholder:https://example.com/file.png`;
    readonly tPdfPreview = $localize`:@@cardModalAddToCard.pdfPreview:PDF preview`;
    @Input({ required: true }) canEdit!: boolean;
    @Input({ required: true }) openPanel!: (name: PanelName) => void;
    @Input({ required: true }) closePanel!: () => void;
    @Input({ required: true }) isPanelOpen!: (name: PanelName) => boolean;

    @Input({ required: true }) labels!: Label[];
    @Input({ required: true }) selectedLabelIds!: Set<string>;
    @Input({ required: true }) toggleLabel!: (lid: string) => void;

    @Input({ required: true }) isEditingLabel!: Signal<boolean>;
    @Input({ required: true }) labelDraftId!: WritableSignal<string | null>;
    @Input({ required: true }) labelNameDraft!: WritableSignal<string>;
    @Input({ required: true }) labelColorDraft!: WritableSignal<string>;
    @Input({ required: true }) labelColors!: string[];
    @Input({ required: true }) startCreateLabel!: () => void;
    @Input({ required: true }) startEditLabel!: (label: { id: string; name: string; color: string }) => void;
    @Input({ required: true }) cancelLabelEdit!: () => void;
    @Input({ required: true }) saveLabel!: () => void;
    @Input({ required: true }) deleteLabel!: () => void;

    @Input({ required: true }) startDraft!: WritableSignal<string | null>;
    @Input({ required: true }) dueDraft!: WritableSignal<string | null>;
    @Input({ required: true }) setDates!: (kind: 'start' | 'due', val: string | null) => void;

    @Input({ required: true }) card!: ModalCard | null;
    @Input({ required: true }) onAssigneesChange!: (list: CardAssignee[]) => void;

    @Input({ required: true }) checklists!: Checklist[];
    @Input({ required: true }) addChecklist!: () => void;
    @Input({ required: true }) renameChecklist!: (cid: string, title: string) => void;
    @Input({ required: true }) deleteChecklist!: (cid: string) => void;
    @Input({ required: true }) addChecklistItem!: (cid: string) => void;
    @Input({ required: true }) toggleChecklistItem!: (cid: string, itemId: string, done: boolean) => void;
    @Input({ required: true }) updateChecklistItemText!: (cid: string, itemId: string, text: string) => void;
    @Input({ required: true }) deleteChecklistItem!: (cid: string, itemId: string) => void;

    @Input({ required: true }) priorityDraft!: WritableSignal<'' | 'low' | 'medium' | 'high' | 'urgent'>;
    @Input({ required: true }) riskDraft!: WritableSignal<'' | 'low' | 'medium' | 'high'>;
    @Input({ required: true }) estimationDraft!: WritableSignal<string>;
    @Input({ required: true }) savePriority!: (val: '' | 'low' | 'medium' | 'high' | 'urgent') => void;
    @Input({ required: true }) saveRisk!: (val: '' | 'low' | 'medium' | 'high') => void;
    @Input({ required: true }) saveEstimation!: (raw: unknown) => void;

    @Input({ required: true }) attachments!: AttachmentDto[];
    @Input({ required: true }) attachUrlDraft!: WritableSignal<string>;
    @Input({ required: true }) renameDraftId!: WritableSignal<string | null>;
    @Input({ required: true }) renameDraftName!: WritableSignal<string>;
    @Input({ required: true }) isUploading!: Signal<boolean>;
    @Input({ required: true }) dropActive!: Signal<boolean>;

    @Input({ required: true }) addAttachmentByUrl!: () => void;
    @Input({ required: true }) addAttachmentFiles!: (input: HTMLInputElement) => void;
    @Input({ required: true }) onDragOver!: (e: DragEvent) => void;
    @Input({ required: true }) onDragLeave!: (e: DragEvent) => void;
    @Input({ required: true }) onDropFiles!: (e: DragEvent) => void;

    @Input({ required: true }) isImage!: (a: AttachmentDto) => boolean;
    @Input({ required: true }) isVideo!: (a: AttachmentDto) => boolean;
    @Input({ required: true }) isAudio!: (a: AttachmentDto) => boolean;
    @Input({ required: true }) isPdf!: (a: AttachmentDto) => boolean;
    @Input({ required: true }) isExternal!: (a: AttachmentDto) => boolean;

    @Input({ required: true }) safeMediaUrl!: (url: string | null | undefined) => SafeResourceUrl;
    @Input({ required: true }) attachmentApiFileUrl!: (a: AttachmentDto) => string;
    @Input({ required: true }) setAsCover!: (id: string) => void;
    @Input({ required: true }) removeCover!: (id: string) => void;
    @Input({ required: true }) previewAttachment!: (a: AttachmentDto) => void;
    @Input({ required: true }) downloadAttachment!: (a: AttachmentDto) => void;
    @Input({ required: true }) isDownloading!: (id: string) => boolean;
    @Input({ required: true }) downloadPercent!: (id: string) => number;
    @Input({ required: true }) humanBytes!: (n?: number | null) => string;
    @Input({ required: true }) startRename!: (a: AttachmentDto) => void;
    @Input({ required: true }) cancelRename!: () => void;
    @Input({ required: true }) saveRename!: () => void;
    @Input({ required: true }) fileExt!: (a: Pick<AttachmentDto, 'name' | 'url'> | { name?: string | null; url?: string | null }) => string;
    @Input({ required: true }) removeAttachment!: (id: string) => void;

    @Input({ required: true }) TagIcon!: any;
    @Input({ required: true }) CalendarIcon!: any;
    @Input({ required: true }) UsersIcon!: any;
    @Input({ required: true }) ListChecksIcon!: any;
    @Input({ required: true }) PaperclipIcon!: any;
    @Input({ required: true }) GaugeIcon!: any;
    @Input({ required: true }) PlusIcon!: any;
    @Input({ required: true }) PencilIcon!: any;
    @Input({ required: true }) CheckIcon!: any;
    @Input({ required: true }) ChevronLeftIcon!: any;
    @Input({ required: true }) XIcon!: any;
    @Input({ required: true }) Trash2Icon!: any;
    @Input({ required: true }) FileTextIcon!: any;
    @Input({ required: true }) ExternalLinkIcon!: any;
    @Input({ required: true }) DownloadIcon!: any;
    @Input({ required: true }) SaveIcon!: any;
    @Input({ required: true }) XCircleIcon!: any;
}
