import { Component, Input, Signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import type { Board, ListDto } from '../../types';
import type { PanelName } from './card-modal.service';

@Component({
    standalone: true,
    selector: 'card-modal-actions',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './card-modal-actions.component.html',
    styleUrls: ['./card-modal.component.css'],
})
export class CardModalActionsComponent {
    @Input({ required: true }) canEdit!: boolean;
    @Input({ required: true }) isPanelOpen!: (name: PanelName) => boolean;
    @Input({ required: true }) closePanel!: () => void;

    @Input({ required: true }) archiveCard!: () => void;
    @Input({ required: true }) prepareMoveOrCopy!: (type: 'move' | 'copy') => void;
    @Input({ required: true }) deleteCard!: () => void;

    @Input({ required: true }) availableBoards!: Board[];
    @Input({ required: true }) targetBoardId!: Signal<string | null>;
    @Input({ required: true }) targetLists!: ListDto[];
    @Input({ required: true }) targetListId!: WritableSignal<string | null>;
    @Input({ required: true }) targetPosition!: WritableSignal<string>;
    @Input({ required: true }) copyTitle!: WritableSignal<string>;
    @Input({ required: true }) isBusyAction!: Signal<boolean>;

    @Input({ required: true }) onTargetBoardChange!: (boardId: string) => void;
    @Input({ required: true }) doMove!: () => void;
    @Input({ required: true }) doCopy!: () => void;
    @Input({ required: true }) doDelete!: () => void;

    @Input({ required: true }) ArchiveIcon!: any;
    @Input({ required: true }) MoveIcon!: any;
    @Input({ required: true }) CopyIcon!: any;
    @Input({ required: true }) Trash2Icon!: any;
    @Input({ required: true }) XIcon!: any;
}
