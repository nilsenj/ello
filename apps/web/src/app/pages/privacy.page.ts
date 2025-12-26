import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChevronDownIcon, LucideAngularModule } from 'lucide-angular';
import { LOCALE_LABELS, SUPPORTED_LOCALES, getStoredLocale, normalizeLocale, setStoredLocale } from '../i18n/i18n';

@Component({
  standalone: true,
  selector: 'public-privacy',
  imports: [CommonModule, RouterLink, LucideAngularModule],
  template: `
    <div class="privacy-root min-h-screen selection:bg-indigo-200 selection:text-slate-900">
      <div class="privacy-bg absolute inset-0 -z-10"></div>

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

      <main class="mx-auto max-w-4xl px-6 pb-20">
        <section class="pt-16 pb-10">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-6 border border-indigo-200/80">
            <span i18n="@@privacy.kicker">Privacy</span>
          </div>
          <h1 class="privacy-title text-4xl sm:text-5xl font-semibold text-slate-900 tracking-tight" i18n="@@privacy.title">
            Your data is yours.
          </h1>
          <p class="mt-5 text-lg text-slate-600 max-w-2xl" i18n="@@privacy.subtitle">
            We keep data collection minimal and focus on making Ello trustworthy and transparent.
          </p>
          <div class="mt-4 text-sm text-slate-500" i18n="@@privacy.updated">
            Last updated: March 2025
          </div>
        </section>

        <section class="space-y-8">
          <div class="privacy-card p-6 rounded-[1.75rem]">
            <h2 class="text-xl font-bold text-slate-900 mb-3" i18n="@@privacy.collect.title">What we collect</h2>
            <p class="text-sm text-slate-600 leading-relaxed" i18n="@@privacy.collect.body">
              We collect basic account information you provide, along with board data you create. We do not sell your data.
            </p>
          </div>

          <div class="privacy-card p-6 rounded-[1.75rem]">
            <h2 class="text-xl font-bold text-slate-900 mb-3" i18n="@@privacy.use.title">How we use data</h2>
            <p class="text-sm text-slate-600 leading-relaxed" i18n="@@privacy.use.body">
              Data is used to operate the service, keep your account secure, and improve product quality. We use anonymized metrics to guide decisions.
            </p>
          </div>

          <div class="privacy-card p-6 rounded-[1.75rem]">
            <h2 class="text-xl font-bold text-slate-900 mb-3" i18n="@@privacy.security.title">Security</h2>
            <p class="text-sm text-slate-600 leading-relaxed" i18n="@@privacy.security.body">
              We use industry-standard protections and limit internal access. If you find a vulnerability, reach out and we will respond quickly.
            </p>
          </div>

          <div class="privacy-card p-6 rounded-[1.75rem]">
            <h2 class="text-xl font-bold text-slate-900 mb-3" i18n="@@privacy.rights.title">Your choices</h2>
            <p class="text-sm text-slate-600 leading-relaxed" i18n="@@privacy.rights.body">
              You can update your profile, delete content, or request account removal. We aim to honor requests promptly.
            </p>
          </div>
        </section>

        <section class="mt-12 rounded-[2rem] border border-indigo-200/70 bg-white/70 p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div class="text-xs uppercase tracking-[0.3em] text-indigo-500 font-bold" i18n="@@privacy.cta.kicker">Questions</div>
            <h3 class="privacy-title text-2xl sm:text-3xl font-semibold text-slate-900 mt-3" i18n="@@privacy.cta.title">
              Want more details?
            </h3>
            <p class="mt-3 text-slate-600" i18n="@@privacy.cta.body">
              Contact us and we will walk you through any privacy concerns.
            </p>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <a
              routerLink="/register"
              class="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-base shadow-[0_18px_35px_-24px_rgba(99,102,241,0.7)] hover:bg-indigo-700 transition-all"
              i18n="@@privacy.cta.start"
            >
              Start your free board
            </a>
            <a
              routerLink="/"
              class="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-slate-300 text-slate-700 font-semibold text-base bg-white/80 hover:bg-white transition-all"
              i18n="@@privacy.cta.back"
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

    .privacy-root {
      font-family: 'Space Grotesk', 'SF Pro Text', 'Segoe UI', sans-serif;
      background-color: #f8fbff;
      color: #0f172a;
    }

    .privacy-title {
      font-family: 'Fraunces', 'Times New Roman', serif;
    }

    .privacy-bg {
      background-image:
        radial-gradient(circle at 12% 15%, rgba(99, 102, 241, 0.16), transparent 42%),
        radial-gradient(circle at 85% 20%, rgba(59, 130, 246, 0.12), transparent 45%),
        radial-gradient(circle at 35% 85%, rgba(148, 163, 184, 0.18), transparent 50%),
        linear-gradient(120deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.4));
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    .privacy-card {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.86));
      border: 1px solid rgba(148, 163, 184, 0.25);
      box-shadow: 0 24px 50px -40px rgba(15, 23, 42, 0.6);
    }
  `]
})
export default class PrivacyPage {
  readonly ChevronDownIcon = ChevronDownIcon;
  supportedLocales = SUPPORTED_LOCALES;
  localeLabels = LOCALE_LABELS;
  currentLocale = getStoredLocale();
  isLocaleMenuOpen = false;

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
