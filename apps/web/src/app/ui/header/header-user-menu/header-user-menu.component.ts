import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClickOutsideDirective } from '../../click-outside.directive';
import { LucideAngularModule, LogOut, Settings, Shield } from 'lucide-angular';

@Component({
    standalone: true,
    selector: 'header-user-menu',
    imports: [CommonModule, ClickOutsideDirective, LucideAngularModule],
    templateUrl: './header-user-menu.component.html'
})
export class HeaderUserMenuComponent {
    readonly LogOutIcon = LogOut;
    readonly SettingsIcon = Settings;
    readonly ShieldIcon = Shield;
    user = input.required<any>();
    initials = input.required<string>();

    logout = output<void>();
    goProfile = output<void>();
    goAdmin = output<void>();

    isOpen = signal(false);
    readonly tAccount = $localize`:@@header.userMenu.account:Account`;
    readonly tProfileSettings = $localize`:@@header.userMenu.profileSettings:Profile & Settings`;
    readonly tAdminConsole = $localize`:@@header.userMenu.adminConsole:Admin Console`;
    readonly tLogout = $localize`:@@header.userMenu.logout:Log out`;
    readonly tUserFallback = $localize`:@@header.userMenu.user:User`;

    toggle() {
        this.isOpen.update(v => !v);
    }

    close() {
        this.isOpen.set(false);
    }
}
