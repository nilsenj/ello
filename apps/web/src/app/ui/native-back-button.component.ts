import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';

@Component({
    standalone: true,
    selector: 'native-back-button',
    imports: [CommonModule],
    template: `
        <button
            *ngIf="isVisible"
            type="button"
            class="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
            (click)="goBack()"
            aria-label="Back">
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M12.5 5.5L8 10l4.5 4.5-1.4 1.4L5.2 10l5.9-5.9 1.4 1.4z" />
            </svg>
            <span>Back</span>
        </button>
    `,
})
export class NativeBackButtonComponent {
    private readonly isNative = Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android';
    isVisible = this.isNative || window.matchMedia('(max-width: 1024px)').matches;

    @HostListener('window:resize')
    onResize() {
        this.isVisible = this.isNative || window.matchMedia('(max-width: 1024px)').matches;
    }

    goBack() {
        window.history.back();
    }
}
