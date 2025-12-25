import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    standalone: true,
    selector: 'header-user-menu',
    imports: [CommonModule],
    templateUrl: './header-user-menu.component.html',
    styles: [`
        .pill {
            background: rgba(255, 255, 255, .2);
            border-radius: .375rem;
            padding: .25rem .5rem;
        }
        .menu-content {
            position: absolute;
            right: 0;
            top: 100%;
            min-width: 220px;
            background: #fff;
            color: #172b4d;
            border-radius: .5rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, .2);
            padding: .5rem;
            z-index: 100;
        }
        .menu-item {
            padding: .5rem .625rem;
            border-radius: .375rem;
            cursor: pointer;
        }
        .menu-item:hover {
            background: #F2F4F7;
        }
        .avatar {
            width: 32px;
            height: 32px;
            border-radius: 9999px;
            background: #2d3748;
            display: inline-grid;
            place-items: center;
            color: #fff;
            font-weight: 600;
        }
        .icon {
            width: 18px;
            height: 18px;
            opacity: .9;
        }
    `]
})
export class HeaderUserMenuComponent {
    user = input.required<any>();
    initials = input.required<string>();

    logout = output<void>();
    goProfile = output<void>();

    isOpen = signal(false);
    readonly tAccount = $localize`:@@header.userMenu.account:Account`;
    readonly tProfileSettings = $localize`:@@header.userMenu.profileSettings:Profile & Settings`;
    readonly tLogout = $localize`:@@header.userMenu.logout:Log out`;
    readonly tUserFallback = $localize`:@@header.userMenu.user:User`;

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
