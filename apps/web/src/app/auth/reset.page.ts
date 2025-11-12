import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
    standalone: true,
    selector: 'auth-reset',
    imports: [CommonModule, FormsModule],
    template: `
  <div class="mx-auto max-w-md p-6">
    <h1 class="text-xl font-semibold mb-4">Choose a new password</h1>
    <form #f="ngForm" (ngSubmit)="submit(f)" class="space-y-3">
      <input class="w-full border rounded p-2" name="password" [(ngModel)]="password" type="password" required placeholder="New password" />
      <button class="w-full bg-black text-white rounded py-2" [disabled]="pending()">Set password</button>
    </form>

    <p *ngIf="ok()" class="text-green-600 mt-3">Password updated. You can log in now.</p>
    <p *ngIf="error()" class="text-red-600 mt-3">{{ error() }}</p>
  </div>
  `
})
export default class ResetPage {
    private ar = inject(ActivatedRoute);
    private auth = inject(AuthService);
    private router = inject(Router);

    password = '';
    pending = signal(false);
    ok = signal(false);
    error = signal<string | null>(null);

    async submit(form: NgForm) {
        if (form.invalid) return;
        const token = this.ar.snapshot.queryParamMap.get('token') || '';
        this.pending.set(true); this.error.set(null); this.ok.set(false);
        try {
            await this.auth.resetPassword(token, this.password);
            this.ok.set(true);
            setTimeout(() => this.router.navigate(['/auth/login']), 900);
        } catch (e: any) {
            this.error.set(e?.error?.message || 'Reset failed');
        } finally {
            this.pending.set(false);
        }
    }
}
