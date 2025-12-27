import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { NativeBackButtonComponent } from '../ui/native-back-button.component';

@Component({
  standalone: true,
  selector: 'auth-register',
  imports: [CommonModule, FormsModule, RouterLink, NativeBackButtonComponent],
  template: `
  <div class="native-safe-top mx-auto max-w-md p-6">
    <native-back-button class="mb-3"></native-back-button>
    <h1 class="text-xl font-semibold mb-4">{{ tTitle }}</h1>

    <form #f="ngForm" (ngSubmit)="submit(f)" class="space-y-3">
      <div class="space-y-1">
        <input class="w-full border rounded p-2" name="name" [(ngModel)]="name" required #nameCtrl="ngModel" [placeholder]="tNamePlaceholder" />
        <p *ngIf="nameCtrl.touched && nameCtrl.invalid" class="text-xs text-red-500">{{ tNameRequired }}</p>
      </div>

      <div class="space-y-1">
        <input class="w-full border rounded p-2" name="email" [(ngModel)]="email" type="email" required email #emailCtrl="ngModel" [placeholder]="tEmailPlaceholder" />
        <p *ngIf="emailCtrl.touched && emailCtrl.invalid" class="text-xs text-red-500">{{ tEmailInvalid }}</p>
      </div>

      <div class="space-y-1">
        <input class="w-full border rounded p-2" name="password" [(ngModel)]="password" type="password" required minlength="6" #passCtrl="ngModel" [placeholder]="tPasswordPlaceholder" />
        <p *ngIf="passCtrl.touched && passCtrl.errors?.['required']" class="text-xs text-red-500">{{ tPasswordRequired }}</p>
        <p *ngIf="passCtrl.touched && passCtrl.errors?.['minlength']" class="text-xs text-red-500">{{ tPasswordMinLength }}</p>
      </div>

      <button class="w-full px-5 py-2.5 text-sm font-bold rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2" [disabled]="f.invalid || pending()">
        <svg *ngIf="pending()" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{{ pending() ? tSubmitting : tSubmit }}</span>
      </button>
    </form>

    <div class="mt-3 text-sm">
      {{ tHaveAccount }} <a routerLink="/login" class="underline">{{ tLoginLink }}</a>
    </div>

    <p *ngIf="error()" class="text-red-600 mt-3 text-sm">{{ error() }}</p>
  </div>
  `
})
export default class RegisterPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  name = '';
  email = '';
  password = '';
  error = signal<string | null>(null);
  pending = signal(false);
  readonly tTitle = $localize`:@@register.title:Create account`;
  readonly tNamePlaceholder = $localize`:@@register.namePlaceholder:Your name`;
  readonly tNameRequired = $localize`:@@register.nameRequired:Name is required.`;
  readonly tEmailPlaceholder = $localize`:@@register.emailPlaceholder:Email`;
  readonly tEmailInvalid = $localize`:@@register.emailInvalid:Please enter a valid email.`;
  readonly tPasswordPlaceholder = $localize`:@@register.passwordPlaceholder:Password`;
  readonly tPasswordRequired = $localize`:@@register.passwordRequired:Password is required.`;
  readonly tPasswordMinLength = $localize`:@@register.passwordMinLength:Password must be at least 6 characters.`;
  readonly tSubmit = $localize`:@@register.submit:Sign up`;
  readonly tSubmitting = $localize`:@@register.submitting:Signing up...`;
  readonly tHaveAccount = $localize`:@@register.haveAccount:Have an account?`;
  readonly tLoginLink = $localize`:@@register.loginLink:Log in`;
  readonly tError = $localize`:@@register.error:Registration failed`;

  async submit(form: NgForm) {
    if (form.invalid) return;
    this.pending.set(true); this.error.set(null);
    try {
      await this.auth.register({ name: this.name.trim(), email: this.email.trim(), password: this.password });
      // auto-login for convenience
      await this.auth.login({ email: this.email.trim(), password: this.password });
      this.router.navigateByUrl('/');
    } catch (e: any) {
      this.error.set(e?.error?.message || this.tError);
    } finally {
      this.pending.set(false);
    }
  }
}
