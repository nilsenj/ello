import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GlobeIcon, ImageIcon, LockIcon, LucideAngularModule, PaletteIcon, XIcon } from 'lucide-angular';
import { Router } from '@angular/router';

import { BoardCreateModalService } from './board-create-modal.service';
import { BoardsService } from '../../data/boards.service';
import { BoardStore } from '../../store/board-store.service';

type Visibility = 'private' | 'workspace' | 'public';

@Component({
    standalone: true,
    selector: 'board-create-modal',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    styleUrls: ['./board-create-modal.component.css'],
    templateUrl: './board-create-modal.component.html',
})
export class BoardCreateModalComponent {
    // icons
    readonly XIcon = XIcon;
    readonly ImageIcon = ImageIcon;
    readonly PaletteIcon = PaletteIcon;
    readonly GlobeIcon = GlobeIcon;
    readonly LockIcon = LockIcon;

    // deps
    modal = inject(BoardCreateModalService);
    boardsApi = inject(BoardsService);
    store = inject(BoardStore);
    router = inject(Router);

    // form state
    name = signal('');
    desc = signal(''); // <-- NEW: description text
    visibility = signal<'private' | 'workspace' | 'public'>('private');
    bgType = signal<'color' | 'image' | 'none'>('color'); // 'none' as safe default
    bgValue = signal<string>('#0079bf'); // default Trello-like blue

    // presets (Trello-esque)
    colorPresets = ['#0079bf', '#d29034', '#519839', '#b04632', '#89609e', '#cd5a91', '#4bbf6b', '#00aecc', '#838c91'];
    imagePresets = [
        // put your CDN/unsplash thumbs here; fallback to colors if empty
    ];

    // background picker state you already use in template

    // submit state
    creating = signal(false); // <-- NEW (fixes this.creating)
    canSubmit = computed(() => this.name().trim().length > 1);

    close() {
        this.modal.close();
    }

    // close on ESC
    @HostListener('document:keydown.escape')
    onEsc() {
        if (this.modal.isOpen()) this.close();
    }

    // click backdrop to close
    onBackdrop(e: MouseEvent) {
        if (e.target && (e.target as HTMLElement).classList.contains('cm-backdrop')) this.close();
    }

    private getCurrentWorkspaceId(): string | null {
        const curBoardId = this.store.currentBoardId();
        if (!curBoardId) return null;
        const board = this.store.boards().find(b => b.id === curBoardId);
        return board?.workspaceId ?? null;
    }

    async createBoard() {
        if (!this.canSubmit()) return;
        this.creating.set(true);
        try {
            // If no workspace found from current board, pass null to let service infer it
            const wsId = this.getCurrentWorkspaceId();

            console.log('Creating board in workspace', wsId);
            console.log((this.name()).trim(),
                (this.desc() || null),
                this.visibility());


            const payload = {
                name: (this.name()).trim(),
                description: ((this.desc())?.trim() || null),
                visibility: this.visibility(),
                background:
                    this.bgType() === 'color' ? this.bgValue()
                        : this.bgType() === 'image' ? this.bgValue()
                            : null,
            };

            const board = await this.boardsApi.createBoard(wsId, payload);
            if (board?.id) {
                await this.boardsApi.selectBoard(board.id);
                this.router.navigate(['/b', board.id]);
                this.close();
            }
        } finally {
            this.creating.set(false);
        }
    }

    pickColor(hex: string) {
        this.bgType.set('color');
        this.bgValue.set(hex);
    }

    pickImage(url: string) {
        this.bgType.set('image');
        this.bgValue.set(url);
    }

    private reset() {
        this.name.set('');
        this.visibility.set('private');
        this.bgType.set('color');
        this.bgValue.set('#0079bf');
    }
}
