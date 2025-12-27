import { Directive, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit, Output } from '@angular/core';

@Directive({
    selector: '[clickOutside]',
    standalone: true,
})
export class ClickOutsideDirective implements OnInit, OnDestroy {
    @Output() clickOutside = new EventEmitter<void>();

    private onDocEvent = (e: Event) => {
        const target = e.target as Node | null;
        if (!target) return;
        if (!this.el.nativeElement.contains(target)) {
            this.zone.run(() => this.clickOutside.emit());
        }
    };

    private onEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            this.zone.run(() => this.clickOutside.emit());
        }
    };

    constructor(private el: ElementRef<HTMLElement>, private zone: NgZone) {}

    ngOnInit() {
        this.zone.runOutsideAngular(() => {
            document.addEventListener('pointerdown', this.onDocEvent, true);
            document.addEventListener('touchstart', this.onDocEvent, true);
            document.addEventListener('click', this.onDocEvent, true);
            document.addEventListener('keydown', this.onEsc, true);
        });
    }

    ngOnDestroy() {
        document.removeEventListener('pointerdown', this.onDocEvent, true);
        document.removeEventListener('touchstart', this.onDocEvent, true);
        document.removeEventListener('click', this.onDocEvent, true);
        document.removeEventListener('keydown', this.onEsc, true);
    }
}
