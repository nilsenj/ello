import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import {
  ColumnsIcon,
  ListPlusIcon,
  LucideAngularModule,
  StarIcon,
  Users,
  LayoutDashboardIcon,
  ZapIcon,
  ShieldCheckIcon
} from 'lucide-angular';

@Component({
  standalone: true,
  selector: 'public-landing',
  imports: [CommonModule, RouterLink, LucideAngularModule],
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
    <div class="min-h-screen bg-white selection:bg-indigo-100 selection:text-indigo-900">
      <!-- Mesh Gradient Background -->
      <div class="absolute inset-0 -z-10 overflow-hidden">
        <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-50/50 blur-[120px]"></div>
        <div class="absolute top-[20%] -right-[5%] w-[35%] h-[35%] rounded-full bg-blue-50/50 blur-[120px]"></div>
        <div class="absolute -bottom-[10%] left-[20%] w-[45%] h-[45%] rounded-full bg-slate-50/50 blur-[120px]"></div>
      </div>

      <!-- Sticky Glassmorphism Header -->
      <header 
        @navbarFade
        class="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-md transition-all duration-300"
      >
        <div class="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <a routerLink="/" class="flex items-center gap-2.5 group transition-transform hover:scale-105">
            <div class="relative w-9 h-9 flex items-center justify-center bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 group-hover:bg-indigo-700 transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white">
                <rect x="4" y="4" width="6" height="16" rx="2" fill="currentColor" fill-opacity="0.9" />
                <rect x="14" y="4" width="6" height="7" rx="2" fill="currentColor" fill-opacity="0.7" />
                <rect x="14" y="13" width="6" height="7" rx="2" fill="currentColor" fill-opacity="0.5" />
              </svg>
            </div>

            <div class="leading-tight">
              <div class="text-2xl font-black tracking-tighter text-slate-900">ello</div>
              <div class="hidden sm:block text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Next-Gen Kanban
              </div>
            </div>
          </a>

          <nav class="flex items-center gap-4">
            <a
              routerLink="/login"
              class="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Sign in
            </a>
            <a
              routerLink="/register"
              class="px-5 py-2.5 text-sm font-bold rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95"
            >
              Get Started
            </a>
          </nav>
        </div>
      </header>

      <main class="mx-auto max-w-7xl px-6">
        <!-- Hero Section -->
        <section class="relative pt-20 pb-24 md:pt-32 md:pb-32 overflow-hidden">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div @fadeInUp>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-6">
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                </span>
                Now in Beta v2.0
              </div>
              <h1 class="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                Work flows <br/>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">better together.</span>
              </h1>
              <p class="mt-8 text-xl text-slate-600 leading-relaxed max-w-xl">
                A high-performance kanban experience built for teams who value speed and clarity. 
                Experience the magic of seamless project management.
              </p>

              <div class="mt-10 flex flex-col sm:flex-row gap-4">
                <a
                  routerLink="/register"
                  class="group relative inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-slate-900 text-white font-bold text-lg overflow-hidden transition-all hover:bg-indigo-600 hover:shadow-2xl hover:shadow-indigo-200"
                >
                  <span class="relative z-10 flex items-center gap-2">
                    Start building for free
                    <lucide-icon [img]="ZapIcon" class="w-5 h-5 group-hover:animate-pulse"></lucide-icon>
                  </span>
                </a>
                <a
                  routerLink="/login"
                  class="inline-flex items-center justify-center px-8 py-4 rounded-2xl border-2 border-slate-200 text-slate-700 font-bold text-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  View Live Demo
                </a>
              </div>

              <div class="mt-12 flex items-center gap-4">
                <div class="flex -space-x-3">
                  <div *ngFor="let i of [1,2,3,4]" class="w-10 h-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                    <img [src]="'https://i.pravatar.cc/100?u=' + i" alt="User" />
                  </div>
                </div>
                <div class="text-sm">
                  <span class="font-bold text-slate-900">500+</span> teams already moving faster with Ello.
                </div>
              </div>
            </div>

            <div @fadeInUp class="relative">
              <div class="absolute -inset-4 bg-gradient-to-tr from-indigo-100 to-blue-100 rounded-[2.5rem] blur-2xl opacity-50 -z-10"></div>
              <div class="rounded-[2rem] border border-slate-200/60 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden">
                <div class="bg-slate-50 border-b border-slate-200 p-4 flex items-center gap-2">
                   <div class="flex gap-1.5">
                     <div class="w-3 h-3 rounded-full bg-red-400"></div>
                     <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
                     <div class="w-3 h-3 rounded-full bg-green-400"></div>
                   </div>
                   <div class="mx-auto text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workspace Overview</div>
                </div>
                <div class="p-8">
                  <div class="grid grid-cols-2 gap-6">
                    <div class="group p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-100 transition-all hover:shadow-xl hover:shadow-indigo-50/50">
                      <lucide-icon [img]="LayoutDashboardIcon" class="h-6 w-6 text-indigo-600 mb-4"></lucide-icon>
                      <div class="text-base font-bold text-slate-900">Dynamic Boards</div>
                      <div class="mt-2 text-sm text-slate-500 leading-relaxed">Customize your workflow with unlimited boards.</div>
                    </div>
                    <div class="group p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-100 transition-all hover:shadow-xl hover:shadow-indigo-50/50">
                      <lucide-icon [img]="ZapIcon" class="h-6 w-6 text-indigo-600 mb-4"></lucide-icon>
                      <div class="text-base font-bold text-slate-900">Real-time Sync</div>
                      <div class="mt-2 text-sm text-slate-500 leading-relaxed">Collaborate instantly with your entire team.</div>
                    </div>
                  </div>
                  
                  <div class="mt-10 rounded-2xl bg-slate-900 p-8 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl transition-all group-hover:scale-150"></div>
                    <div class="relative z-10">
                      <div class="text-lg font-bold text-white">Elite Performance</div>
                      <p class="mt-2 text-slate-400 text-sm leading-relaxed">
                        Optimized for speed. Drag, drop, and edit with zero lag.
                      </p>
                      <div class="mt-6 h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full w-2/3 bg-indigo-500 rounded-full animate-[loading_2s_ease-in-out_infinite]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Features Grid -->
        <section class="py-24 border-t border-slate-100">
          <div class="text-center mb-16">
            <h2 class="text-3xl font-black text-slate-900 sm:text-4xl">Everything you need to ship.</h2>
            <p class="mt-4 text-slate-500 text-lg">Powerful features without the bloat.</p>
          </div>
          
          <div @staggerFade class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div *ngFor="let feature of features" class="stagger-item group p-8 rounded-[2rem] border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-100/40 transition-all duration-300">
              <div class="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                <lucide-icon [img]="feature.icon" class="w-6 h-6"></lucide-icon>
              </div>
              <h3 class="text-xl font-bold text-slate-900 mb-3">{{feature.title}}</h3>
              <p class="text-slate-500 leading-relaxed">{{feature.description}}</p>
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="py-12 border-t border-slate-100">
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
            
            <div class="flex gap-8 text-sm font-semibold text-slate-400">
              <a routerLink="/login" class="hover:text-slate-900 transition-colors">Documentation</a>
              <a routerLink="/login" class="hover:text-slate-900 transition-colors">Changelog</a>
              <a routerLink="/login" class="hover:text-slate-900 transition-colors">Privacy</a>
            </div>

            <div class="text-sm font-medium text-slate-400">
              © {{ currentYear }} Ello Kanban. Built with ❤️ for developers.
            </div>
          </div>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    @keyframes loading {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(50%); }
      100% { transform: translateX(100%); }
    }
  `]
})
export default class LandingPage {
  readonly ColumnsIcon = ColumnsIcon;
  readonly ListPlusIcon = ListPlusIcon;
  readonly StarIcon = StarIcon;
  readonly UsersIcon = Users;
  readonly LayoutDashboardIcon = LayoutDashboardIcon;
  readonly ZapIcon = ZapIcon;
  readonly ShieldCheckIcon = ShieldCheckIcon;

  currentYear = new Date().getFullYear();

  features = [
    {
      title: 'Real-time Updates',
      description: 'Experience instant synchronization across all devices. No more manual refreshing.',
      icon: ZapIcon
    },
    {
      title: 'Intuitive Design',
      description: 'A clean, distraction-free interface that puts your work front and center.',
      icon: LayoutDashboardIcon
    },
    {
      title: 'Secure by Default',
      description: 'Enterprise-grade security for your personal and team projects.',
      icon: ShieldCheckIcon
    }
  ];
}
