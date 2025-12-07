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
      <input class="w-full border rounded p-2" name="name" [(ngModel)]="name" placeholder="Your name" />
      <input class="w-full border rounded p-2" name="email" [(ngModel)]="email" type="email" required placeholder="Email" />
      <input class="w-full border rounded p-2" name="password" [(ngModel)]="password" type="password" required placeholder="Password" />
      <button class="w-full bg-black text-white rounded py-2" [disabled]="pending()">Sign up</button>
    </form>

    <div class="mt-3 text-sm">
      Have an account? <a routerLink="/login" class="underline">Log in</a>
    </div>

    <p *ngIf="error()" class="text-red-600 mt-3">{{ error() }}</p>
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
