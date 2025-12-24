import { Component, Input, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import type { CommentDto } from '../../types';

@Component({
    standalone: true,
    selector: 'card-modal-comments',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './card-modal-comments.component.html',
    styleUrls: ['./card-modal.component.css'],
})
export class CardModalCommentsComponent {
    @Input({ required: true }) canEdit!: boolean;
    @Input({ required: true }) commentDraft!: WritableSignal<string>;
    @Input({ required: true }) comments!: CommentDto[];
    @Input({ required: true }) isCommentBlank!: () => boolean;
    @Input({ required: true }) addComment!: () => void;
    @Input({ required: true }) deleteComment!: (id: string) => void;

    @Input({ required: true }) SendIcon!: any;
    @Input({ required: true }) Trash2Icon!: any;
}
