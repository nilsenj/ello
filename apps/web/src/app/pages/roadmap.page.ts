import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChevronDownIcon, LucideAngularModule } from 'lucide-angular';
import { LOCALE_LABELS, SUPPORTED_LOCALES, getStoredLocale, normalizeLocale, setStoredLocale } from '../i18n/i18n';

@Component({
  standalone: true,
  selector: 'public-roadmap',
  imports: [CommonModule, RouterLink, LucideAngularModule],
  template: `
    <div class="roadmap-root min-h-screen selection:bg-indigo-200 selection:text-slate-900">
      <div class="roadmap-bg absolute inset-0 -z-10"></div>

      <header class="sticky top-0 z-50 w-full border-b border-indigo-200/60 bg-white/70 backdrop-blur-md">
        <div class="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <a routerLink="/" class="flex items-center gap-3 group transition-transform hover:scale-105">
            <div class="relative w-9 h-9 flex items-center justify-center bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 group-hover:bg-indigo-700 transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="text-white">
                <rect x="4" y="4" width="6" height="16" rx="2" fill="currentColor" fill-opacity="0.9" />
                <rect x="14" y="4" width="6" height="7" rx="2" fill="currentColor" fill-opacity="0.7" />
                <rect x="14" y="13" width="6" height="7" rx="2" fill="currentColor" fill-opacity="0.5" />
              </svg>
            </div>
            <div class="leading-tight">
              <div class="text-2xl font-black tracking-tighter text-slate-900">ello</div>
              <div class="hidden sm:block text-[10px] uppercase tracking-wider font-bold text-slate-400" i18n="@@landing.brandTagline">
                Personal Kanban
              </div>
            </div>
          </a>

          <nav class="flex items-center gap-4">
            <div class="relative" (click)="$event.stopPropagation()">
              <button
                class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                type="button"
                (click)="toggleLocaleMenu()"
                aria-haspopup="listbox"
                [attr.aria-expanded]="isLocaleMenuOpen"
                aria-label="Language"
                i18n-aria-label="@@settings.language"
              >
                <span>{{ localeLabels[currentLocale] }}</span>
                <lucide-icon [img]="ChevronDownIcon" class="w-3.5 h-3.5 text-slate-400"></lucide-icon>
              </button>
              <div
                *ngIf="isLocaleMenuOpen"
                class="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 p-1"
                role="listbox"
              >
                <button
                  *ngFor="let code of supportedLocales"
                  type="button"
                  class="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors"
                  [class.bg-indigo-50]="code === currentLocale"
                  [class.text-indigo-700]="code === currentLocale"
                  [class.text-slate-600]="code !== currentLocale"
                  [class.hover:bg-slate-50]="code !== currentLocale"
                  (click)="onLocaleSelect(code)"
                >
                  <span>{{ localeLabels[code] }}</span>
                  <span *ngIf="code === currentLocale" class="text-[10px] uppercase tracking-widest">Active</span>
                </button>
              </div>
            </div>
            <a
              routerLink="/login"
              class="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
              i18n="@@landing.signIn"
            >
              Sign in
            </a>
            <a
              routerLink="/register"
              class="px-5 py-2.5 text-sm font-bold rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
              i18n="@@landing.getStarted"
            >
              Get Started
            </a>
          </nav>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-6 pb-20">
        <section class="pt-16 pb-12">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-6 border border-indigo-200/80">
            <span i18n="@@roadmap.kicker">Product roadmap</span>
          </div>
          <h1 class="roadmap-title text-4xl sm:text-5xl font-semibold text-slate-900 tracking-tight" i18n="@@roadmap.title">
            A clear view of what is next for Ello.
          </h1>
          <p class="mt-5 text-lg text-slate-600 max-w-2xl" i18n="@@roadmap.subtitle">
            We share the direction and the focus areas so you can plan with us.
          </p>
          <div class="mt-6 text-sm text-slate-500" i18n="@@roadmap.note">
            This roadmap is directional and may change as we learn.
          </div>
        </section>

        <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div *ngFor="let column of roadmapColumns" class="roadmap-col p-6 rounded-[1.75rem]">
            <div class="flex items-center justify-between mb-4">
              <div class="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">{{ column.kicker }}</div>
              <div class="text-[11px] font-semibold text-slate-500">{{ column.range }}</div>
            </div>
            <h2 class="text-xl font-bold text-slate-900 mb-3">{{ column.title }}</h2>
            <ul class="space-y-3 text-sm text-slate-600">
              <li *ngFor="let item of column.items" class="roadmap-item">
                <span class="roadmap-dot"></span>
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </section>

        <section class="mt-16 rounded-[2rem] border border-indigo-200/70 bg-white/70 p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div class="text-xs uppercase tracking-[0.3em] text-indigo-500 font-bold" i18n="@@roadmap.cta.kicker">Stay in the loop</div>
            <h3 class="roadmap-title text-2xl sm:text-3xl font-semibold text-slate-900 mt-3" i18n="@@roadmap.cta.title">
              Ready to build on the roadmap?
            </h3>
            <p class="mt-3 text-slate-600" i18n="@@roadmap.cta.body">
              Start a board today and follow the updates as we ship.
            </p>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <a
              routerLink="/register"
              class="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-base shadow-[0_18px_35px_-24px_rgba(99,102,241,0.7)] hover:bg-indigo-700 transition-all"
              i18n="@@roadmap.cta.start"
            >
              Start your free board
            </a>
            <a
              routerLink="/"
              class="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-300 text-slate-700 font-semibold text-base bg-white/80 hover:bg-white transition-all"
              i18n="@@roadmap.cta.back"
            >
              Back to landing
            </a>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

    :host {
      display: block;
    }

    .roadmap-root {
      font-family: 'Space Grotesk', 'SF Pro Text', 'Segoe UI', sans-serif;
      background-color: #f8fbff;
      color: #0f172a;
    }

    .roadmap-title {
      font-family: 'Fraunces', 'Times New Roman', serif;
    }

    .roadmap-bg {
      background-image:
        radial-gradient(circle at 12% 15%, rgba(99, 102, 241, 0.16), transparent 42%),
        radial-gradient(circle at 85% 20%, rgba(59, 130, 246, 0.12), transparent 45%),
        radial-gradient(circle at 35% 85%, rgba(148, 163, 184, 0.18), transparent 50%),
        linear-gradient(120deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.4));
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    .roadmap-col {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.86));
      border: 1px solid rgba(148, 163, 184, 0.25);
      box-shadow: 0 24px 50px -40px rgba(15, 23, 42, 0.6);
      position: relative;
      overflow: hidden;
    }

    .roadmap-col::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.08), transparent 60%);
      pointer-events: none;
    }

    .roadmap-item {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .roadmap-dot {
      margin-top: 6px;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #6366f1;
      flex: 0 0 6px;
    }
  `]
})
export default class RoadmapPage {
  readonly ChevronDownIcon = ChevronDownIcon;
  supportedLocales = SUPPORTED_LOCALES;
  localeLabels = LOCALE_LABELS;
  currentLocale = getStoredLocale();
  isLocaleMenuOpen = false;

  roadmapColumns = [
    {
      kicker: $localize`:@@roadmap.now.kicker:Now`,
      range: $localize`:@@roadmap.now.range:0-2 months`,
      title: $localize`:@@roadmap.now.title:Polish the core`,
      items: [
        $localize`:@@roadmap.now.item1:Faster board loading and snappier cards`,
        $localize`:@@roadmap.now.item2:Cleaner mobile layout and gesture fixes`,
        $localize`:@@roadmap.now.item3:Better onboarding and starter templates`
      ]
    },
    {
      kicker: $localize`:@@roadmap.next.kicker:Next`,
      range: $localize`:@@roadmap.next.range:3-5 months`,
      title: $localize`:@@roadmap.next.title:Plan with clarity`,
      items: [
        $localize`:@@roadmap.next.item1:Calendar and schedule view`,
        $localize`:@@roadmap.next.item2:Template gallery with quick setups`,
        $localize`:@@roadmap.next.item3:Simple automations for routine steps`
      ]
    },
    {
      kicker: $localize`:@@roadmap.later.kicker:Later`,
      range: $localize`:@@roadmap.later.range:6-12 months`,
      title: $localize`:@@roadmap.later.title:Connect your workflow`,
      items: [
        $localize`:@@roadmap.later.item1:Google Calendar and Slack links`,
        $localize`:@@roadmap.later.item2:Shared boards with lightweight roles`,
        $localize`:@@roadmap.later.item3:Team insights without heavy analytics`
      ]
    },
    {
      kicker: $localize`:@@roadmap.explore.kicker:Exploring`,
      range: $localize`:@@roadmap.explore.range:Research`,
      title: $localize`:@@roadmap.explore.title:Smarter assistance`,
      items: [
        $localize`:@@roadmap.explore.item1:Weekly summaries and auto-priorities`,
        $localize`:@@roadmap.explore.item2:Offline-first mode for travel`,
        $localize`:@@roadmap.explore.item3:Importers for common task tools`
      ]
    }
  ];

  toggleLocaleMenu() {
    this.isLocaleMenuOpen = !this.isLocaleMenuOpen;
  }

  onLocaleSelect(code: string) {
    this.isLocaleMenuOpen = false;
    this.onLocaleChange(code);
  }

  onLocaleChange(next: string) {
    const normalized = normalizeLocale(next);
    if (normalized === this.currentLocale) return;
    this.currentLocale = normalized;
    setStoredLocale(normalized);
    window.location.reload();
  }

  @HostListener('document:click')
  closeLocaleMenu() {
    this.isLocaleMenuOpen = false;
  }
}
