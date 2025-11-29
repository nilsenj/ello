import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, X, User, Lock, Save } from 'lucide-angular';
import { UserSettingsModalService } from './user-settings-modal.service';
import { AuthService } from '../../auth/auth.service';

@Component({
    standalone: true,
    selector: 'user-settings-modal',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './user-settings-modal.component.html',
})
export class UserSettingsModalComponent {
    modal = inject(UserSettingsModalService);
    auth = inject(AuthService);

    // Icons
    readonly XIcon = X;
    readonly UserIcon = User;
    readonly LockIcon = Lock;
    readonly SaveIcon = Save;

    // State
    activeTab = signal<'profile' | 'security'>('profile');

    // Form Data
    name = signal('');
    avatar = signal('');
    password = signal('');
    confirmPassword = signal('');

    // UI State
    isSaving = signal(false);
    error = signal<string | null>(null);
    success = signal<string | null>(null);

    constructor() {
        effect(() => {
            if (this.modal.isOpen()) {
                // Reset state on open
                const user = this.auth.user();
                this.name.set(user?.name || '');
                this.avatar.set(user?.avatar || '');
                this.password.set('');
                this.confirmPassword.set('');
                this.error.set(null);
                this.success.set(null);
                this.activeTab.set('profile');
            }
        }, { allowSignalWrites: true });
    }

    close() {
        this.modal.close();
    }

    async saveProfile() {
        this.error.set(null);
        this.success.set(null);
        this.isSaving.set(true);

        try {
            await this.auth.updateProfile({
                name: this.name(),
                avatar: this.avatar()
            });
            this.success.set('Profile updated successfully');
            setTimeout(() => this.success.set(null), 3000);
        } catch (err) {
            this.error.set('Failed to update profile');
        } finally {
            this.isSaving.set(false);
        }
    }

    async savePassword() {
        this.error.set(null);
        this.success.set(null);

        if (this.password() !== this.confirmPassword()) {
            this.error.set('Passwords do not match');
            return;
        }

        if (this.password().length < 6) {
            this.error.set('Password must be at least 6 characters');
            return;
        }

        this.isSaving.set(true);

        try {
            await this.auth.updateProfile({
                password: this.password()
            });
            this.success.set('Password updated successfully');
            this.password.set('');
            this.confirmPassword.set('');
            setTimeout(() => this.success.set(null), 3000);
        } catch (err) {
            this.error.set('Failed to update password');
        } finally {
            this.isSaving.set(false);
        }
    }
}
