import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    standalone: true,
    selector: 'header-create-menu',
    imports: [CommonModule],
    templateUrl: './header-create-menu.component.html',
    styles: [`
        .btn {
            background: #fff;
            color: #172b4d;
            border-radius: .375rem;
            padding: .375rem .625rem;
            font-size: .875rem;
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
export class HeaderCreateMenuComponent {
    createBoard = output<void>();
    createCard = output<void>();

    isOpen = signal(false);

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
}
