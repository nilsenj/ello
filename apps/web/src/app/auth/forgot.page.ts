import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from './auth.service';

@Component({
    standalone: true,
    selector: 'auth-forgot',
    imports: [CommonModule, FormsModule],
    template: `
  <div class="mx-auto max-w-md p-6">
    <h1 class="text-xl font-semibold mb-4">Reset your password</h1>
    <form #f="ngForm" (ngSubmit)="submit(f)" class="space-y-3">
      <input class="w-full border rounded p-2" name="email" [(ngModel)]="email" type="email" required placeholder="Email" />
      <button class="w-full bg-black text-white rounded py-2" [disabled]="pending()">Send reset link</button>
    </form>

    <p *ngIf="info()" class="text-green-600 mt-3">{{ info() }}</p>
    <p *ngIf="token()" class="text-xs mt-2">Dev token: <code>{{ token() }}</code></p>
    <p *ngIf="error()" class="text-red-600 mt-3">{{ error() }}</p>
  </div>
  `
})
export default class ForgotPage {
    private auth = inject(AuthService);
    email = '';
    pending = signal(false);
    info = signal<string | null>(null);
    token = signal<string | null>(null);
    error = signal<string | null>(null);

    async submit(form: NgForm) {
        if (form.invalid) return;
        this.pending.set(true); this.error.set(null); this.info.set(null);
        try {
            const res = await this.auth.requestPassword(this.email.trim());
            this.info.set('If the email exists, a reset link has been sent.');
            this.token.set(res?.resetToken || null); // useful in dev
        } catch (e: any) {
            this.error.set(e?.error?.message || 'Request failed');
        } finally {
            this.pending.set(false);
        }
    }
}
