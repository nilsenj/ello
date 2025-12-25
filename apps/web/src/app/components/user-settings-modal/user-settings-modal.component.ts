import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, X, User, Lock, Save } from 'lucide-angular';
import { UserSettingsModalService } from './user-settings-modal.service';
import { AuthService } from '../../auth/auth.service';
import { LOCALE_LABELS, SUPPORTED_LOCALES, getStoredLocale, setStoredLocale } from '../../i18n/i18n';

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
    supportedLocales = SUPPORTED_LOCALES;
    localeLabels = LOCALE_LABELS;
    locale = signal(getStoredLocale());
    savedLocale = signal(getStoredLocale());
    localeDirty = computed(() => this.locale() !== this.savedLocale());
    readonly tAccountSettings = $localize`:@@settings.account:Account Settings`;
    readonly tProfile = $localize`:@@settings.profile:Profile`;
    readonly tSecurity = $localize`:@@settings.security:Security`;
    readonly tProfileDetails = $localize`:@@settings.profileDetails:Profile Details`;
    readonly tFullName = $localize`:@@settings.fullName:Full Name`;
    readonly tAvatarUrl = $localize`:@@settings.avatarUrl:Avatar URL`;
    readonly tAvatarHint = $localize`:@@settings.avatarHint:Enter a direct link to an image file.`;
    readonly tNamePlaceholder = $localize`:@@settings.namePlaceholder:Enter your name`;
    readonly tAvatarPlaceholder = $localize`:@@settings.avatarPlaceholder:https://example.com/avatar.jpg`;
    readonly tLanguage = $localize`:@@settings.language:Language`;
    readonly tApplyLanguage = $localize`:@@settings.applyLanguage:Apply language`;
    readonly tLanguageHint = $localize`:@@settings.languageHint:Changing language reloads the app.`;
    readonly tSaveChanges = $localize`:@@settings.saveChanges:Save Changes`;
    readonly tSaving = $localize`:@@settings.saving:Saving...`;
    readonly tChangePassword = $localize`:@@settings.changePassword:Change Password`;
    readonly tNewPassword = $localize`:@@settings.newPassword:New Password`;
    readonly tConfirmPassword = $localize`:@@settings.confirmPassword:Confirm Password`;
    readonly tPasswordPlaceholder = $localize`:@@settings.passwordPlaceholder:Enter new password`;
    readonly tConfirmPasswordPlaceholder = $localize`:@@settings.confirmPasswordPlaceholder:Confirm new password`;
    readonly tUpdatePassword = $localize`:@@settings.updatePassword:Update Password`;
    readonly tProfileUpdated = $localize`:@@settings.profileUpdated:Profile updated successfully`;
    readonly tFailedUpdateProfile = $localize`:@@settings.profileUpdateFailed:Failed to update profile`;
    readonly tPasswordsNoMatch = $localize`:@@settings.passwordMismatch:Passwords do not match`;
    readonly tPasswordTooShort = $localize`:@@settings.passwordTooShort:Password must be at least 6 characters`;
    readonly tPasswordUpdated = $localize`:@@settings.passwordUpdated:Password updated successfully`;
    readonly tFailedUpdatePassword = $localize`:@@settings.passwordUpdateFailed:Failed to update password`;
    readonly tLanguageReloading = $localize`:@@settings.languageReloading:Language updated. Reloading…`;

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
                const current = getStoredLocale();
                this.locale.set(current);
                this.savedLocale.set(current);
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
            const user = this.auth.user();
            const profileChanged = this.name() !== (user?.name || '') || this.avatar() !== (user?.avatar || '');

            if (profileChanged) {
                await this.auth.updateProfile({
                    name: this.name(),
                    avatar: this.avatar()
                });
            }

            if (this.localeDirty()) {
                setStoredLocale(this.locale());
                this.success.set(this.tLanguageReloading);
                setTimeout(() => window.location.reload(), 400);
                return;
            }

            if (profileChanged) {
                this.success.set(this.tProfileUpdated);
                setTimeout(() => this.success.set(null), 3000);
            }
        } catch (err) {
            this.error.set(this.tFailedUpdateProfile);
        } finally {
            this.isSaving.set(false);
        }
    }

    async savePassword() {
        this.error.set(null);
        this.success.set(null);

        if (this.password() !== this.confirmPassword()) {
            this.error.set(this.tPasswordsNoMatch);
            return;
        }

        if (this.password().length < 6) {
            this.error.set(this.tPasswordTooShort);
            return;
        }

        this.isSaving.set(true);

        try {
            await this.auth.updateProfile({
                password: this.password()
            });
            this.success.set(this.tPasswordUpdated);
            this.password.set('');
            this.confirmPassword.set('');
            setTimeout(() => this.success.set(null), 3000);
        } catch (err) {
            this.error.set(this.tFailedUpdatePassword);
        } finally {
            this.isSaving.set(false);
        }
    }

    applyLanguage() {
        const next = this.locale();
        if (!next || !this.localeDirty()) return;
        setStoredLocale(next);
        this.success.set(this.tLanguageReloading);
        setTimeout(() => window.location.reload(), 400);
    }
}
