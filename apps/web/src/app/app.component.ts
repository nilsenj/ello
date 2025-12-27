import { Component, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { BoardCreateModalComponent } from "./components/board-create-modal/board-create-modal.component";
import { PushService } from './core/push.service';
import { Capacitor } from '@capacitor/core';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, BoardCreateModalComponent],
  template: `
      <router-outlet></router-outlet>
  `
})
export class AppComponent implements OnDestroy {
  private isNative = Capacitor.getPlatform() !== 'web';

  private onTouchEnd = (event: TouchEvent) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest('a[routerlink],a[routerLink]') as HTMLAnchorElement | null;
    if (!link) return;
    const route = link.getAttribute('routerlink')
      || link.getAttribute('routerLink')
      || link.getAttribute('href');
    if (!route || route.startsWith('http') || route.startsWith('mailto:') || route.startsWith('tel:')) return;
    event.preventDefault();
    this.zone.run(() => this.router.navigateByUrl(route));
  };

  private onNavWake = () => {
    if (!this.isNative) return;
    this.zone.run(() => {
      void document.body?.offsetHeight;
    });
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  };

  constructor(
    private push: PushService,
    private router: Router,
    private zone: NgZone,
  ) {
    this.push.init();
    if (this.isNative) {
      document.addEventListener('touchend', this.onTouchEnd, true);
      window.addEventListener('popstate', this.onNavWake, true);
      window.addEventListener('pageshow', this.onNavWake, true);
    }
  }

  ngOnDestroy() {
    if (this.isNative) {
      document.removeEventListener('touchend', this.onTouchEnd, true);
      window.removeEventListener('popstate', this.onNavWake, true);
      window.removeEventListener('pageshow', this.onNavWake, true);
    }
  }
}
