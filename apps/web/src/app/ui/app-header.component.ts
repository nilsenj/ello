// apps/web/src/app/ui/app-header.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
    standalone: true,
    selector: 'app-header',
    imports: [CommonModule, RouterLink],
    template: `
  <header class="w-full border-b">
    <div class="mx-auto max-w-7xl px-4 py-2 flex items-center gap-3">
      <a routerLink="/" class="font-semibold">Ello Kanban</a>
      <span class="flex-1"></span>

      <ng-container *ngIf="auth.isAuthed(); else guest">
        <div class="flex items-center gap-2">
          <img *ngIf="auth.user()?.avatar" [src]="auth.user()?.avatar" class="w-6 h-6 rounded-full" />
          <span>{{ auth.user()?.name || auth.user()?.email }}</span>
          <button class="ml-2 text-sm underline" (click)="auth.logout()">Logout</button>
        </div>
      </ng-container>

      <ng-template #guest>
        <a routerLink="/auth/login" class="text-sm underline">Log in</a>
      </ng-template>
    </div>
  </header>
  `
})
export class AppHeaderComponent {
    auth = inject(AuthService);
}
