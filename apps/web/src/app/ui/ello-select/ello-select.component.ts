import { Component, forwardRef, input, Input, signal, computed, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { LucideAngularModule, ChevronDownIcon, CheckIcon } from 'lucide-angular';
import { ClickOutsideDirective } from '../click-outside.directive';

export interface ElloSelectOption {
    label: string;
    value: any;
    icon?: any;
    disabled?: boolean;
}

@Component({
    standalone: true,
    selector: 'ello-select',
    imports: [CommonModule, LucideAngularModule, ClickOutsideDirective, FormsModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => ElloSelectComponent),
            multi: true
        }
    ],
    template: `
        <div class="relative w-full" clickOutside (clickOutside)="close()">
            <!-- Trigger Button -->
            <button type="button"
                class="w-full relative flex items-center justify-between min-h-[40px] px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                [class.ring-2]="isOpen()"
                [class.ring-blue-500]="isOpen()"
                [class.border-blue-500]="isOpen()"
                [class.bg-gray-50]="disabled()"
                [disabled]="disabled()"
                (click)="toggle()"
                [attr.aria-expanded]="isOpen()">

                <div class="flex items-center gap-2 truncate">
                    <lucide-icon *ngIf="selectedOption()?.icon" [img]="selectedOption()?.icon" class="w-4 h-4 text-gray-500 shrink-0"></lucide-icon>
                    <span class="truncate block" [class.text-gray-400]="!selectedOption()">
                        {{ selectedOption()?.label || placeholder() }}
                    </span>
                </div>

                <lucide-icon [img]="ChevronDownIcon" class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" [class.rotate-180]="isOpen()"></lucide-icon>
            </button>

            <!-- Dropdown Menu -->
            <div *ngIf="isOpen()"
                class="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto focus:outline-none origin-top transition-all"
                >
                <div class="p-1">
                    <button *ngFor="let opt of options(); trackBy: trackByOption"
                        type="button"
                        class="w-full flex items-center justify-between px-3 py-2 text-sm rounded-sm hover:bg-gray-100 transition-colors"
                        [class.bg-blue-50]="opt.value == value()"
                        [class.text-blue-700]="opt.value == value()"
                        [class.text-gray-900]="opt.value != value() && !opt.disabled"
                        [class.text-gray-400]="opt.disabled"
                        [class.cursor-not-allowed]="opt.disabled"
                        [class.hover:bg-transparent]="opt.disabled"
                        [disabled]="opt.disabled"
                        (click)="selectOpt(opt, $event)">

                        <div class="flex items-center gap-2 truncate">
                            <lucide-icon *ngIf="opt.icon" [img]="opt.icon" class="w-4 h-4 shrink-0"></lucide-icon>
                            <span class="truncate">{{ opt.label }}</span>
                        </div>

                        <lucide-icon *ngIf="opt.value == value()" [img]="CheckIcon" class="w-4 h-4 shrink-0 px-0 my-0"></lucide-icon>
                    </button>

                    <div *ngIf="options()?.length === 0" class="px-3 py-2 text-sm text-gray-500 text-center">
                        No options
                    </div>
                </div>
            </div>
        </div>
    `
})
export class ElloSelectComponent implements ControlValueAccessor, OnInit {
    options = input.required<ElloSelectOption[]>();
    placeholder = input<string>('Select an option');
    
    // We use a traditional @Input for disabled so it integrates with ControlValueAccessor neatly,
    // though signal inputs can also work, traditional is sometimes easier for form statuses.
    disabled = signal(false);

    value = signal<any>(null);
    isOpen = signal(false);

    readonly ChevronDownIcon = ChevronDownIcon;
    readonly CheckIcon = CheckIcon;

    // ControlValueAccessor methods
    onChange: any = () => {};
    onTouch: any = () => {};

    ngOnInit() {
        // Init
    }

    selectedOption = computed(() => this.options()?.find(o => o.value == this.value()));

    toggle() {
        if (!this.disabled()) {
            this.isOpen.update(v => !v);
        }
    }

    close() {
        if (this.isOpen()) {
            this.isOpen.set(false);
            this.onTouch();
        }
    }

    selectOpt(opt: ElloSelectOption, event: Event) {
        event.preventDefault();
        event.stopPropagation();
        if (opt.disabled) return;
        
        console.log('ello-select: selectOpt called with', opt.value);
        this.value.set(opt.value);
        this.onChange(opt.value);
        this.onTouch();
        this.close();
    }

    writeValue(val: any): void {
        console.log('ello-select: writeValue called with', val);
        this.value.set(val);
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouch = fn;
    }

    setDisabledState?(isDisabled: boolean): void {
        this.disabled.set(isDisabled);
    }

    trackByOption(index: number, opt: ElloSelectOption): any {
        return opt.value;
    }
}
