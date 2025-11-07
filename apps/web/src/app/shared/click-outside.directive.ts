import { Directive, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit, Output } from '@angular/core';

@Directive({
    selector: '[clickOutside]',
    standalone: true,
})
export class ClickOutsideDirective implements OnInit, OnDestroy {
    @Output() clickOutside = new EventEmitter<void>();

    private onDocClick = (e: Event) => {
        const target = e.target as Node | null;
        if (!target) return;
        if (!this.host.nativeElement.contains(target)) {
            // back to Angular zone to emit
            this.zone.run(() => this.clickOutside.emit());
        }
    };

    private onEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            this.zone.run(() => this.clickOutside.emit());
        }
    };

    constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

    ngOnInit() {
        this.zone.runOutsideAngular(() => {
            document.addEventListener('click', this.onDocClick, true);
            document.addEventListener('touchstart', this.onDocClick, true);
            document.addEventListener('keydown', this.onEsc, true);
        });
    }

    ngOnDestroy() {
        document.removeEventListener('click', this.onDocClick, true);
        document.removeEventListener('touchstart', this.onDocClick, true);
        document.removeEventListener('keydown', this.onEsc, true);
    }
}
