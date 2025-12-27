import { Directive, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import flatpickr from 'flatpickr';
import type { Instance as FlatpickrInstance, Options } from 'flatpickr/dist/types/options';

@Directive({
    selector: '[flatpickr]',
    standalone: true,
})
export class FlatpickrDirective implements OnInit, OnChanges, OnDestroy {
    @Input() flatpickrOptions: Partial<Options> = {};
    @Input() flatpickrValue: string | Date | null = null;
    @Output() flatpickrChange = new EventEmitter<string>();

    private instance: FlatpickrInstance | null = null;

    constructor(private el: ElementRef<HTMLInputElement>) {}

    ngOnInit() {
        this.init();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['flatpickrOptions'] && !changes['flatpickrOptions'].firstChange) {
            this.destroy();
            this.init();
        }
        if (changes['flatpickrValue'] && this.instance) {
            const value = this.flatpickrValue || null;
            this.instance.setDate(value as any, false);
            if (typeof value === 'string') {
                this.el.nativeElement.value = value;
            }
        }
    }

    ngOnDestroy() {
        this.destroy();
    }

    private init() {
        const userOnChange = this.flatpickrOptions.onChange;
        const options: Partial<Options> = {
            dateFormat: 'Y-m-d',
            allowInput: true,
            ...this.flatpickrOptions,
            onChange: (selectedDates, dateStr, instance) => {
                this.flatpickrChange.emit(dateStr);
                if (userOnChange) {
                    userOnChange(selectedDates, dateStr, instance);
                }
            },
        };
        this.instance = flatpickr(this.el.nativeElement, options as Options);
        if (this.flatpickrValue) {
            this.instance.setDate(this.flatpickrValue as any, false);
        }
    }

    private destroy() {
        if (this.instance) {
            this.instance.destroy();
            this.instance = null;
        }
    }
}
