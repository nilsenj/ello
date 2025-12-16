import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  standalone: true,
  selector: 'auth-login',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="mx-auto max-w-md p-6">
    <h1 class="text-xl font-semibold mb-4">Log in</h1>

    <form #f="ngForm" (ngSubmit)="submit(f)" class="space-y-3">
      <div class="space-y-1">
        <input class="w-full border rounded p-2" name="email" [(ngModel)]="email" type="email" required email #emailCtrl="ngModel" placeholder="Email" />
        <p *ngIf="emailCtrl.touched && emailCtrl.invalid" class="text-xs text-red-500">Please enter a valid email.</p>
      </div>

      <div class="space-y-1">
        <input class="w-full border rounded p-2" name="password" [(ngModel)]="password" type="password" required minlength="6" #passCtrl="ngModel" placeholder="Password" />
        <p *ngIf="passCtrl.touched && passCtrl.errors?.['required']" class="text-xs text-red-500">Password is required.</p>
        <p *ngIf="passCtrl.touched && passCtrl.errors?.['minlength']" class="text-xs text-red-500">Password must be at least 6 characters.</p>
      </div>

      <button class="w-full bg-black text-white rounded py-2 hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2" [disabled]="f.invalid || pending()">
        <svg *ngIf="pending()" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{{ pending() ? 'Logging in...' : 'Log in' }}</span>
      </button>
    </form>

    <div class="mt-3 flex justify-between text-sm">
      <a routerLink="/register" class="underline">Create account</a>
      <a routerLink="/forgot" class="underline">Forgot password?</a>
    </div>

    <p *ngIf="error()" class="text-red-600 mt-3 text-sm">{{ error() }}</p>
  </div>
  `
})
export default class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private ar = inject(ActivatedRoute);

  email = '';
  password = '';
  error = signal<string | null>(null);
  pending = signal(false);

  async submit(form: NgForm) {
    if (form.invalid) return;
    this.pending.set(true); this.error.set(null);
    try {
      await this.auth.login({ email: this.email.trim(), password: this.password });
      const redirect = this.ar.snapshot.queryParamMap.get('redirect') || '/';
      this.router.navigateByUrl(redirect);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Login failed');
    } finally {
      this.pending.set(false);
    }
  }
}
