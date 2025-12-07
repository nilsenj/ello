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
    bgValue = signal<string>('blue'); // default Trello-like blue ID

    // presets (Trello-esque)
    // Unified presets matching KanbanBoard and BoardMenu
    colorPresets = [
        { id: 'blue', value: '#0079bf' },
        { id: 'orange', value: '#d29034' },
        { id: 'green', value: '#519839' },
        { id: 'red', value: '#b04632' },
        { id: 'purple', value: '#89609e' },
        { id: 'pink', value: '#cd5a91' },
        { id: 'gradient-blue', value: 'linear-gradient(to bottom right, #60a5fa, #06b6d4)' },
        { id: 'gradient-purple', value: 'linear-gradient(to bottom right, #c084fc, #ec4899)' },
        { id: 'gradient-sunset', value: 'linear-gradient(to bottom right, #fb923c, #ef4444)' }
    ];

    imagePresets = [
        'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1000&q=80'
    ];

    // background picker state you already use in template

    // submit state
    creating = signal(false);
    error = signal<string | null>(null);
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
        // 1. Check if passed explicitly via modal service (e.g. from home page)
        const explicitId = this.modal.workspaceId();
        if (explicitId) return explicitId;

        // 2. Fallback to current board's workspace (e.g. from header inside a board)
        const curBoardId = this.store.currentBoardId();
        if (!curBoardId) return null;
        const board = this.store.boards().find(b => b.id === curBoardId);
        return board?.workspaceId ?? null;
    }

    async createBoard() {
        if (!this.canSubmit()) return;
        this.creating.set(true);
        this.error.set(null);
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
        } catch (err: any) {
            console.error('Failed to create board', err);
            this.error.set(err?.error?.error || 'Failed to create board');
        } finally {
            this.creating.set(false);
        }
    }

    pickColor(id: string) {
        this.bgType.set('color');
        this.bgValue.set(id);
    }

    getPreviewStyle() {
        if (this.bgType() === 'image') {
            return `url(${this.bgValue()}) center / cover`;
        }
        const preset = this.colorPresets.find(c => c.id === this.bgValue());
        return preset ? preset.value : '#0079bf';
    }

    pickImage(url: string) {
        this.bgType.set('image');
        this.bgValue.set(url);
    }

    private reset() {
        this.name.set('');
        this.visibility.set('private');
        this.bgType.set('color');
        this.bgValue.set('blue');
    }
}
