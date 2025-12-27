import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClickOutsideDirective } from '../../click-outside.directive';

@Component({
    standalone: true,
    selector: 'header-board-switcher',
    imports: [CommonModule, ClickOutsideDirective],
    templateUrl: './header-board-switcher.component.html',
    styles: [`
        .pill {
            background: rgba(255, 255, 255, .2);
            border-radius: .375rem;
            padding: .25rem .5rem;
        }
        .menu-content {
            position: absolute;
            left: 0;
            top: 100%;
            min-width: 220px;
            background: #fff;
            color: #172b4d;
            border-radius: .5rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, .2);
            padding: .5rem;
            z-index: 100;
        }
    `]
})
export class HeaderBoardSwitcherComponent {
    currentBoardName = input.required<string>();
    currentBoardId = input<string | null>(null);
    boardsByWorkspace = input.required<any[]>();

    switchBoard = output<string>();

    isOpen = signal(false);
    readonly tYourBoards = $localize`:@@header.switcher.yourBoards:Your Boards`;

    toggle() {
        this.isOpen.update(v => !v);
    }

    close() {
        this.isOpen.set(false);
    }

    onBlur(ev: FocusEvent) {
        const next = ev.relatedTarget as HTMLElement | null;
        if (!next || !(ev.currentTarget as HTMLElement).contains(next)) {
            this.close();
        }
    }

    getBoardBackgroundClass(bg: string | null | undefined): string {
        const bgMap: Record<string, string> = {
            'none': 'bg-slate-50',
            'blue': 'bg-blue-500',
            'green': 'bg-green-500',
            'purple': 'bg-purple-500',
            'red': 'bg-red-500',
            'orange': 'bg-orange-500',
            'pink': 'bg-pink-500',
            'gradient-blue': 'bg-gradient-to-br from-blue-400 to-cyan-500',
            'gradient-purple': 'bg-gradient-to-br from-purple-400 to-pink-500',
            'gradient-sunset': 'bg-gradient-to-br from-orange-400 to-red-500',
            'gradient-forest': 'bg-gradient-to-br from-green-400 to-emerald-600',
            'gradient-ocean': 'bg-gradient-to-br from-cyan-500 to-blue-700',
        };
        return bg && bgMap[bg] ? bgMap[bg] : 'bg-slate-50';
    }
}
