import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import type { CommentDto } from '../../types';
import { CardsService } from '../../data/cards.service';

@Component({
    standalone: true,
    selector: 'card-modal-comments',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './card-modal-comments.component.html',
    styleUrls: ['./card-modal.component.css'],
})
export class CardModalCommentsComponent implements OnChanges {
    private cardsApi = inject(CardsService);

    @Input({ required: true }) cardId!: string;
    @Input({ required: true }) canEdit!: boolean;
    @Input({ required: true }) comments!: CommentDto[];
    @Output() commentsUpdated = new EventEmitter<CommentDto[]>();

    @Input({ required: true }) SendIcon!: any;
    @Input({ required: true }) Trash2Icon!: any;

    commentDraft = '';
    localComments: CommentDto[] = [];

    ngOnChanges(changes: SimpleChanges) {
        if (changes['comments']) {
            this.localComments = (this.comments ?? []).slice();
        }
    }

    isCommentBlank() {
        return !this.commentDraft.trim();
    }

    async addComment() {
        if (!this.cardId) return;
        const text = this.commentDraft.trim();
        if (!text) return;
        try {
            const created = await this.cardsApi.addComment(this.cardId, { text });
            if (!created) return;
            const next = [...this.localComments, created];
            this.localComments = next;
            this.commentsUpdated.emit(next);
            this.commentDraft = '';
        } catch (err) {
            console.error('Failed to add comment', err);
        }
    }

    async deleteComment(commentId: string) {
        if (!this.cardId) return;
        try {
            await this.cardsApi.deleteComment(commentId);
            const next = this.localComments.filter(x => x.id !== commentId);
            this.localComments = next;
            this.commentsUpdated.emit(next);
        } catch (err) {
            console.error('Failed to delete comment', err);
        }
    }
}
