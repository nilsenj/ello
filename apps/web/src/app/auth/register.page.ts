import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  standalone: true,
  selector: 'auth-register',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="mx-auto max-w-md p-6">
    <h1 class="text-xl font-semibold mb-4">Create account</h1>

    <form #f="ngForm" (ngSubmit)="submit(f)" class="space-y-3">
      <div class="space-y-1">
        <input class="w-full border rounded p-2" name="name" [(ngModel)]="name" required #nameCtrl="ngModel" placeholder="Your name" />
        <p *ngIf="nameCtrl.touched && nameCtrl.invalid" class="text-xs text-red-500">Name is required.</p>
      </div>

      <div class="space-y-1">
        <input class="w-full border rounded p-2" name="email" [(ngModel)]="email" type="email" required email #emailCtrl="ngModel" placeholder="Email" />
        <p *ngIf="emailCtrl.touched && emailCtrl.invalid" class="text-xs text-red-500">Please enter a valid email.</p>
      </div>

      <div class="space-y-1">
        <input class="w-full border rounded p-2" name="password" [(ngModel)]="password" type="password" required minlength="6" #passCtrl="ngModel" placeholder="Password" />
        <p *ngIf="passCtrl.touched && passCtrl.errors?.['required']" class="text-xs text-red-500">Password is required.</p>
        <p *ngIf="passCtrl.touched && passCtrl.errors?.['minlength']" class="text-xs text-red-500">Password must be at least 6 characters.</p>
      </div>

      <button class="w-full bg-black text-white rounded py-2 hover:bg-gray-800 disabled:opacity-50" [disabled]="f.invalid || pending()">Sign up</button>
    </form>

    <div class="mt-3 text-sm">
      Have an account? <a routerLink="/login" class="underline">Log in</a>
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

  async submit(form: NgForm) {
    if (form.invalid) return;
    this.pending.set(true); this.error.set(null);
    try {
      await this.auth.register({ name: this.name.trim(), email: this.email.trim(), password: this.password });
      // auto-login for convenience
      await this.auth.login({ email: this.email.trim(), password: this.password });
      this.router.navigateByUrl('/');
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Registration failed');
    } finally {
      this.pending.set(false);
    }
  }
}
