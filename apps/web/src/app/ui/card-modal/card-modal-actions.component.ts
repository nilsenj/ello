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
    readonly tActions = $localize`:@@cardModalActions.title:Actions`;
    readonly tArchive = $localize`:@@cardModalActions.archive:Archive`;
    readonly tMove = $localize`:@@cardModalActions.move:Move`;
    readonly tCopy = $localize`:@@cardModalActions.copy:Copy`;
    readonly tDelete = $localize`:@@cardModalActions.delete:Delete`;
    readonly tMoveCard = $localize`:@@cardModalActions.moveCard:Move Card`;
    readonly tCopyCard = $localize`:@@cardModalActions.copyCard:Copy Card`;
    readonly tClose = $localize`:@@cardModalActions.close:Close`;
    readonly tBoard = $localize`:@@cardModalActions.board:Board`;
    readonly tList = $localize`:@@cardModalActions.list:List`;
    readonly tLoadingLists = $localize`:@@cardModalActions.loadingLists:Loading lists...`;
    readonly tPosition = $localize`:@@cardModalActions.position:Position`;
    readonly tTop = $localize`:@@cardModalActions.top:Top`;
    readonly tBottom = $localize`:@@cardModalActions.bottom:Bottom`;
    readonly tTitle = $localize`:@@cardModalActions.titleField:Title`;
    readonly tDeleteCardPrompt = $localize`:@@cardModalActions.deleteCardPrompt:Delete Card?`;
    readonly tDeleteWarning = $localize`:@@cardModalActions.deleteWarning:All actions will be removed from the activity feed and you won't be able to re-open the card. There is no undo.`;
    readonly tDeleting = $localize`:@@cardModalActions.deleting:Deleting...`;
    @Input({ required: true }) canArchive!: boolean;
    @Input({ required: true }) canMoveCopy!: boolean;
    @Input({ required: true }) canDelete!: boolean;
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
