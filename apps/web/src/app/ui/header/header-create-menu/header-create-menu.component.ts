import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClickOutsideDirective } from '../../click-outside.directive';

@Component({
    standalone: true,
    selector: 'header-create-menu',
    imports: [CommonModule, ClickOutsideDirective],
    templateUrl: './header-create-menu.component.html',
    styles: [`
        .btn {
            background: #fff;
            color: #172b4d;
            border-radius: .375rem;
            padding: .375rem .625rem;
            font-size: .875rem;
        }
    `]
})
export class HeaderCreateMenuComponent {
    createBoard = output<void>();
    createCard = output<void>();

    isOpen = signal(false);
    readonly tCreate = $localize`:@@header.create.title:Create`;
    readonly tCreateBoard = $localize`:@@header.create.board:Create board`;
    readonly tCreateBoardDesc = $localize`:@@header.create.boardDesc:A board is made up of cards ordered on lists.`;
    readonly tCreateCard = $localize`:@@header.create.card:Create card`;
    readonly tCreateCardDesc = $localize`:@@header.create.cardDesc:Create a card to track a task.`;

    toggle() {
        this.isOpen.update(v => !v);
    }

    close() {
        this.isOpen.set(false);
    }
}
