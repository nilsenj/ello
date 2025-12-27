import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import {
  ChevronDownIcon,
  ColumnsIcon,
  ListPlusIcon,
  LucideAngularModule,
  Users,
  LayoutDashboardIcon,
  ZapIcon,
  ShieldCheckIcon
} from 'lucide-angular';
import { LOCALE_LABELS, SUPPORTED_LOCALES, getStoredLocale, normalizeLocale, setStoredLocale } from '../i18n/i18n';
import { ClickOutsideDirective } from '../ui/click-outside.directive';

@Component({
  standalone: true,
  selector: 'public-landing',
  imports: [CommonModule, RouterLink, LucideAngularModule, ClickOutsideDirective],
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('600ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerFade', [
      transition(':enter', [
        query('.stagger-item', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger(100, [
            animate('600ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('navbarFade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('400ms 200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ],
  template: `
    <div class="landing-root min-h-screen selection:bg-indigo-200 selection:text-slate-900">
      <div class="landing-bg absolute inset-0 -z-10"></div>

      <header
        @navbarFade
        class="native-safe-header sticky top-0 z-50 w-full border-b border-indigo-200/60 bg-white/70 backdrop-blur-md transition-all duration-300"
      >
        <div class="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-row flex-wrap items-center justify-between gap-4">
          <a routerLink="/" class="flex items-center gap-3 group transition-transform hover:scale-105">
            <div class="relative w-9 h-9 flex items-center justify-center bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 group-hover:bg-indigo-700 transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white">
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

          <nav class="flex flex-wrap items-center gap-3 sm:gap-4 w-auto justify-end">
            <div class="relative" clickOutside (clickOutside)="isLocaleMenuOpen = false">
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
                class="absolute left-0 sm:left-auto sm:right-0 mt-2 w-48 sm:w-44 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 p-1"
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
              class="native-hide px-5 py-2.5 text-sm font-bold rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
              i18n="@@landing.getStarted"
            >
              Get Started
            </a>
          </nav>
        </div>
      </header>

      <main class="mx-auto max-w-7xl px-6">
        <section class="relative pt-20 pb-24 md:pt-28 md:pb-32 overflow-hidden">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div @fadeInUp>
              <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-6 border border-indigo-200/80 shadow-[0_12px_30px_-20px_rgba(99,102,241,0.4)]">
                <span class="relative flex h-2.5 w-2.5">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60"></span>
                  <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
                </span>
                <span i18n="@@landing.alphaBadge">Now in Alpha</span>
              </div>
              <h1 class="hero-title text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-slate-900 leading-[1.05]">
                <span i18n="@@landing.heroTitleLine1">A lightweight kanban</span>
                <span class="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500" i18n="@@landing.heroTitleLine2">
                  for personal flow.
                </span>
              </h1>
              <p class="mt-8 text-xl text-slate-600 leading-relaxed max-w-xl" i18n="@@landing.heroBody">
                Ello is a fast, focused alternative for individuals who want clarity without the weight of big tools.
                Simple lists, clean cards, and zero noise.
              </p>

              <div class="mt-8 flex flex-wrap gap-3">
                <div class="pill">
                  <lucide-icon [img]="ColumnsIcon" class="w-4 h-4"></lucide-icon>
                  <span i18n="@@landing.pill.lanes">Simple lanes</span>
                </div>
                <div class="pill">
                  <lucide-icon [img]="ListPlusIcon" class="w-4 h-4"></lucide-icon>
                  <span i18n="@@landing.pill.capture">Quick capture</span>
                </div>
                <div class="pill">
                  <lucide-icon [img]="UsersIcon" class="w-4 h-4"></lucide-icon>
                  <span i18n="@@landing.pill.solo">Built for solo focus</span>
                </div>
              </div>

              <div class="mt-10 flex flex-col sm:flex-row gap-4">
                <a
                  routerLink="/register"
                  class="group relative inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-bold text-lg overflow-hidden shadow-[0_18px_40px_-20px_rgba(99,102,241,0.6)] transition-all hover:from-indigo-500 hover:to-sky-500"
                >
                  <span class="relative z-10 flex items-center gap-2">
                    <span i18n="@@landing.cta.startFree">Start building for free</span>
                    <lucide-icon [img]="ZapIcon" class="w-5 h-5 group-hover:animate-pulse"></lucide-icon>
                  </span>
                </a>
                <a
                  routerLink="/login"
                  class="inline-flex items-center justify-center px-8 py-4 rounded-2xl border-2 border-slate-300 text-slate-700 font-bold text-lg bg-white/70 hover:bg-white hover:border-slate-400 transition-all"
                  i18n="@@landing.cta.viewDemo"
                >
                  View Live Demo
                </a>
              </div>

              <div class="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-xl">
                <div *ngFor="let stat of stats" class="rounded-2xl border border-indigo-200/70 bg-white/70 p-4 shadow-[0_15px_35px_-28px_rgba(15,23,42,0.6)]">
                  <div class="text-xl sm:text-2xl font-bold text-slate-900 break-words">{{ stat.value }}</div>
                  <div class="text-[10px] uppercase tracking-widest text-slate-500 mt-1 leading-tight break-words">{{ stat.label }}</div>
                </div>
              </div>
            </div>

            <div @fadeInUp class="relative">
              <div class="absolute -inset-8 bg-gradient-to-tr from-indigo-100 via-blue-100 to-slate-100 rounded-[3rem] blur-3xl opacity-70 -z-10"></div>
              <div class="preview-shell w-full rounded-[1.75rem] sm:rounded-[2.5rem] border border-indigo-200/60 shadow-[0_40px_100px_-60px_rgba(15,23,42,0.6)] overflow-hidden">
                <div class="bg-white/80 border-b border-indigo-200/60 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
                  <div class="flex gap-1.5">
                    <div class="w-3 h-3 rounded-full bg-rose-400"></div>
                    <div class="w-3 h-3 rounded-full bg-sky-400"></div>
                    <div class="w-3 h-3 rounded-full bg-indigo-400"></div>
                  </div>
                  <div class="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]" i18n="@@landing.preview.title">Personal Flow</div>
                  <div class="px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-bold bg-indigo-100 text-indigo-700" i18n="@@landing.preview.alpha">Alpha</div>
                </div>

                <div class="p-4 sm:p-8 space-y-4 sm:space-y-6">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div class="rounded-2xl bg-slate-50/80 border border-slate-200/60 p-3 sm:p-4 space-y-3">
                      <div class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400" i18n="@@landing.preview.backlog">Backlog</div>
                      <div class="h-6 rounded-lg bg-white border border-slate-200"></div>
                      <div class="h-6 rounded-lg bg-white border border-slate-200"></div>
                      <div class="h-8 rounded-xl bg-indigo-600/90 text-white text-xs font-semibold flex items-center px-3">
                        <span i18n="@@landing.preview.refineLanding">Refine landing</span>
                      </div>
                    </div>
                    <div class="rounded-2xl bg-slate-50/80 border border-slate-200/60 p-3 sm:p-4 space-y-3">
                      <div class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400" i18n="@@landing.preview.inProgress">In Progress</div>
                      <div class="h-8 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center px-3">
                        <span i18n="@@landing.preview.launchCopy">Launch copy</span>
                      </div>
                      <div class="h-6 rounded-lg bg-white border border-slate-200"></div>
                      <div class="h-6 rounded-lg bg-white border border-slate-200"></div>
                    </div>
                    <div class="rounded-2xl bg-slate-50/80 border border-slate-200/60 p-3 sm:p-4 space-y-3">
                      <div class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400" i18n="@@landing.preview.done">Done</div>
                      <div class="h-6 rounded-lg bg-white border border-slate-200"></div>
                      <div class="h-8 rounded-xl bg-blue-500 text-white text-xs font-semibold flex items-center px-3">
                        <span i18n="@@landing.preview.weeklyPlan">Weekly plan</span>
                      </div>
                      <div class="h-6 rounded-lg bg-white border border-slate-200"></div>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div class="rounded-2xl bg-slate-900 p-4 sm:p-5 text-white relative overflow-hidden">
                      <div class="absolute -top-10 -right-6 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>
                      <div class="text-[11px] uppercase tracking-widest text-indigo-200" i18n="@@landing.preview.momentum">Momentum</div>
                      <div class="mt-3 flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                          <lucide-icon [img]="ZapIcon" class="w-5 h-5 text-indigo-200"></lucide-icon>
                        </div>
                        <div class="text-xl font-bold">+12%</div>
                      </div>
                    </div>
                    <div class="rounded-2xl bg-white/90 border border-slate-200/60 p-4 sm:p-5">
                      <div class="text-[11px] uppercase tracking-widest text-slate-400" i18n="@@landing.preview.focus">Focus</div>
                      <div class="mt-3 text-sm text-slate-600 leading-relaxed" i18n="@@landing.preview.focusBody">
                        Smart limits keep WIP balanced and blockers visible.
                      </div>
                      <div class="mt-4 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div class="h-full w-3/4 bg-indigo-500 rounded-full animate-[loading_2.4s_ease-in-out_infinite]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="hidden sm:block absolute -right-6 top-24 rounded-2xl bg-white/80 border border-slate-200/70 px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg animate-[float_10s_ease-in-out_infinite]" i18n="@@landing.preview.loved">
                Loved by solo makers
              </div>
              <div class="hidden sm:block absolute -left-6 bottom-10 rounded-2xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold shadow-xl animate-[float_12s_ease-in-out_infinite]" i18n="@@landing.preview.zeroSetup">
                Zero setup
              </div>
            </div>
          </div>
        </section>

        <section class="py-24 border-t border-indigo-100/70">
          <div class="text-center mb-16 max-w-3xl mx-auto">
            <div class="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold" i18n="@@landing.why.kicker">Why Ello</div>
            <h2 class="hero-title text-3xl font-semibold text-slate-900 sm:text-4xl mt-4" i18n="@@landing.why.title">
              A calmer way to plan your day.
            </h2>
            <p class="mt-4 text-slate-500 text-lg" i18n="@@landing.why.body">
              Every surface is designed to keep your personal work visible and stress-free.
            </p>
          </div>

          <div @staggerFade class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div *ngFor="let feature of features" class="feature-card stagger-item group p-8 rounded-[2rem] transition-all duration-300 hover:translate-y-[-4px]">
              <div class="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 mb-6 group-hover:scale-110 transition-transform">
                <lucide-icon [img]="feature.icon" class="w-6 h-6"></lucide-icon>
              </div>
              <h3 class="text-xl font-bold text-slate-900 mb-3">{{ feature.title }}</h3>
              <p class="text-slate-500 leading-relaxed">{{ feature.description }}</p>
            </div>
          </div>
        </section>

        <section class="py-20 border-t border-indigo-100/70">
          <div class="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-10 mb-12">
            <div class="max-w-2xl">
              <div class="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold" i18n="@@landing.useCases.kicker">Use Cases</div>
              <h2 class="hero-title text-3xl font-semibold text-slate-900 sm:text-4xl mt-4" i18n="@@landing.useCases.title">
                Built for small business ops.
              </h2>
              <p class="mt-4 text-slate-500 text-lg" i18n="@@landing.useCases.body">
                Keep work moving across sales, fulfillment, and daily operations without a heavy toolchain.
              </p>
            </div>
            <div class="text-sm font-semibold text-slate-500" i18n="@@landing.useCases.note">
              One board per team, all the essentials.
            </div>
          </div>

          <div @staggerFade class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div *ngFor="let item of useCases" class="feature-card stagger-item p-6 rounded-[1.75rem] transition-all duration-300 hover:-translate-y-1">
              <div class="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">{{ item.kicker }}</div>
              <h3 class="mt-4 text-lg font-semibold text-slate-900">{{ item.title }}</h3>
              <p class="mt-2 text-sm text-slate-500 leading-relaxed">{{ item.description }}</p>
              <div class="mt-4 text-xs font-semibold text-indigo-600">{{ item.note }}</div>
            </div>
          </div>
        </section>

        <section class="py-20">
          <div class="cta-panel relative overflow-hidden rounded-[2.75rem] px-10 py-12 md:px-16">
            <div class="absolute top-0 right-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-[120px]"></div>
            <div class="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
              <div class="max-w-xl">
                <div class="text-xs uppercase tracking-[0.3em] text-indigo-200 font-bold" i18n="@@landing.cta.kicker">Alpha release</div>
                <h3 class="hero-title text-3xl sm:text-4xl font-semibold mt-4" i18n="@@landing.cta.title">
                  Make your next board feel effortless.
                </h3>
                <p class="mt-4 text-slate-300 text-lg" i18n="@@landing.cta.body">
                  Spin up a personal board in seconds and keep your focus where it belongs.
                </p>
              </div>
              <div class="flex flex-col sm:flex-row gap-4">
                <a
                  routerLink="/register"
                  class="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-white text-slate-900 font-bold text-lg shadow-[0_16px_30px_-20px_rgba(255,255,255,0.6)] hover:bg-indigo-100 transition-all"
                  i18n="@@landing.cta.start"
                >
                  Start your free board
                </a>
                <a
                  routerLink="/roadmap"
                  class="inline-flex items-center justify-center px-8 py-4 rounded-2xl border border-white/40 text-white font-semibold text-lg hover:bg-white/10 transition-all"
                  i18n="@@landing.cta.roadmap"
                >
                  See the roadmap
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer class="py-12 border-t border-indigo-100/70">
          <div class="flex flex-col md:flex-row items-center justify-between gap-8">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 flex items-center justify-center bg-slate-900 rounded-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="text-white">
                  <rect x="4" y="4" width="6" height="16" rx="2" fill="currentColor" />
                  <rect x="14" y="4" width="6" height="7" rx="2" fill="currentColor" fill-opacity="0.7" />
                  <rect x="14" y="13" width="6" height="7" rx="2" fill="currentColor" fill-opacity="0.4" />
                </svg>
              </div>
              <span class="font-bold text-slate-900 text-lg tracking-tighter">ello</span>
            </div>

            <div class="flex gap-8 text-sm font-semibold text-slate-500">
              <a routerLink="/login" class="hover:text-slate-900 transition-colors" i18n="@@landing.footer.doc">Documentation</a>
              <a routerLink="/login" class="hover:text-slate-900 transition-colors" i18n="@@landing.footer.changelog">Changelog</a>
              <a routerLink="/privacy" class="hover:text-slate-900 transition-colors" i18n="@@landing.footer.privacy">Privacy</a>
            </div>

            <div class="text-sm font-medium text-slate-400">
              {{ footerCopyright }}
            </div>
          </div>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

    :host {
      display: block;
    }

    .landing-root {
      font-family: 'Space Grotesk', 'SF Pro Text', 'Segoe UI', sans-serif;
      background-color: #f8fbff;
      color: #0f172a;
    }

    .hero-title {
      font-family: 'Fraunces', 'Times New Roman', serif;
    }

    .landing-bg {
      background-image:
        radial-gradient(circle at 10% 10%, rgba(99, 102, 241, 0.16), transparent 40%),
        radial-gradient(circle at 90% 20%, rgba(59, 130, 246, 0.14), transparent 45%),
        radial-gradient(circle at 30% 85%, rgba(148, 163, 184, 0.18), transparent 50%),
        linear-gradient(120deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.3));
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    .landing-bg::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px);
      background-size: 48px 48px;
      opacity: 0.35;
      pointer-events: none;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.85rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.35);
      font-size: 0.85rem;
      font-weight: 600;
      color: #1e293b;
    }

    .preview-shell {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
    }

    .feature-card {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.8));
      border: 1px solid rgba(148, 163, 184, 0.25);
      box-shadow: 0 24px 50px -40px rgba(15, 23, 42, 0.6);
    }

    .cta-panel {
      background: radial-gradient(circle at top left, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
      box-shadow: 0 35px 90px -50px rgba(15, 23, 42, 0.8);
      color: #f8fafc;
    }

    @keyframes loading {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(50%); }
      100% { transform: translateX(100%); }
    }

    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
  `]
})
export default class LandingPage {
  readonly ColumnsIcon = ColumnsIcon;
  readonly ListPlusIcon = ListPlusIcon;
  readonly UsersIcon = Users;
  readonly LayoutDashboardIcon = LayoutDashboardIcon;
  readonly ZapIcon = ZapIcon;
  readonly ShieldCheckIcon = ShieldCheckIcon;
  readonly ChevronDownIcon = ChevronDownIcon;
  supportedLocales = SUPPORTED_LOCALES;
  localeLabels = LOCALE_LABELS;
  currentLocale = getStoredLocale();
  isLocaleMenuOpen = false;

  currentYear = new Date().getFullYear();
  footerCopyright = $localize`:@@landing.footer.copyright:© ${this.currentYear}:year: Ello Kanban. Built with ❤️ for developers.`;

  stats = [
    { value: $localize`:@@landing.stats.twoMin:2 min`, label: $localize`:@@landing.stats.cleanSetup:To start your board` },
    { value: $localize`:@@landing.stats.zeroValue:Free`, label: $localize`:@@landing.stats.zeroFriction:No setup cost` },
    { value: $localize`:@@landing.stats.lightValue:Lightweight`, label: $localize`:@@landing.stats.dailyFocus:Made for daily focus` }
  ];

  features = [
    {
      title: $localize`:@@landing.features.quickCapture.title:Quick Capture`,
      description: $localize`:@@landing.features.quickCapture.desc:Add ideas fast and keep your backlog tidy without extra steps.`,
      icon: ZapIcon
    },
    {
      title: $localize`:@@landing.features.lightViews.title:Lightweight Views`,
      description: $localize`:@@landing.features.lightViews.desc:Just the essentials for seeing what is next and what is done.`,
      icon: LayoutDashboardIcon
    },
    {
      title: $localize`:@@landing.features.private.title:Private by Default`,
      description: $localize`:@@landing.features.private.desc:Your board stays yours. No complexity, just control.`,
      icon: ShieldCheckIcon
    }
  ];

  useCases = [
    {
      kicker: $localize`:@@landing.useCases.sales.kicker:Sales`,
      title: $localize`:@@landing.useCases.sales.title:Lead pipeline`,
      description: $localize`:@@landing.useCases.sales.desc:Track inbound inquiries, quotes, and follow-ups from one view.`,
      note: $localize`:@@landing.useCases.sales.note:Never miss a callback.`
    },
    {
      kicker: $localize`:@@landing.useCases.fulfillment.kicker:Fulfillment`,
      title: $localize`:@@landing.useCases.fulfillment.title:Order progress`,
      description: $localize`:@@landing.useCases.fulfillment.desc:Move orders from prep to packing to delivery with clear handoffs.`,
      note: $localize`:@@landing.useCases.fulfillment.note:Make delays visible fast.`
    },
    {
      kicker: $localize`:@@landing.useCases.operations.kicker:Operations`,
      title: $localize`:@@landing.useCases.operations.title:Daily checklists`,
      description: $localize`:@@landing.useCases.operations.desc:Open/close routines, inventory checks, and recurring tasks.`,
      note: $localize`:@@landing.useCases.operations.note:Keep the day on rails.`
    },
    {
      kicker: $localize`:@@landing.useCases.support.kicker:Support`,
      title: $localize`:@@landing.useCases.support.title:Customer issues`,
      description: $localize`:@@landing.useCases.support.desc:Log tickets, triage fixes, and keep customers in the loop.`,
      note: $localize`:@@landing.useCases.support.note:Resolve without chaos.`
    }
  ];

  onLocaleChange(next: string) {
    const normalized = normalizeLocale(next);
    if (normalized === this.currentLocale) return;
    this.currentLocale = normalized;
    setStoredLocale(normalized);
    window.location.reload();
  }

  toggleLocaleMenu() {
    this.isLocaleMenuOpen = !this.isLocaleMenuOpen;
  }

  onLocaleSelect(code: string) {
    this.isLocaleMenuOpen = false;
    this.onLocaleChange(code);
  }

  @HostListener('document:click')
  closeLocaleMenu() {
    this.isLocaleMenuOpen = false;
  }
}
