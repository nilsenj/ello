import { Directive, ElementRef, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
    selector: '[clickOutside]',
    standalone: true,
})
export class ClickOutsideDirective {
    @Output() clickOutside = new EventEmitter<void>();

    constructor(private el: ElementRef<HTMLElement>) {}

    @HostListener('document:click', ['$event'])
    onDocClick(ev: MouseEvent) {
        const target = ev.target as Node | null;
        if (target && !this.el.nativeElement.contains(target)) {
            this.clickOutside.emit();
        }
    }
}
