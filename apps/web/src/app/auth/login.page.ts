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
      <input class="w-full border rounded p-2" name="email" [(ngModel)]="email" type="email" required placeholder="Email" />
      <input class="w-full border rounded p-2" name="password" [(ngModel)]="password" type="password" required placeholder="Password" />
      <button class="w-full bg-black text-white rounded py-2" [disabled]="pending()">Log in</button>
    </form>

    <div class="mt-3 flex justify-between text-sm">
      <a routerLink="/register" class="underline">Create account</a>
      <a routerLink="/forgot" class="underline">Forgot password?</a>
    </div>

    <p *ngIf="error()" class="text-red-600 mt-3">{{ error() }}</p>
  </div>
  `
})
export default class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private ar = inject(ActivatedRoute);

  email = 'user@ello.dev';
  password = 'user123';
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
