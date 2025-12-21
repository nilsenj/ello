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
