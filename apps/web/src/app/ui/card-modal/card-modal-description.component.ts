import { Component, Input, Signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { SafeHtmlPipe } from '../../shared/safe-html.pipe';

@Component({
    standalone: true,
    selector: 'card-modal-description',
    imports: [CommonModule, FormsModule, LucideAngularModule, SafeHtmlPipe],
    templateUrl: './card-modal-description.component.html',
    styleUrls: ['./card-modal.component.css'],
})
export class CardModalDescriptionComponent {
    @Input({ required: true }) descDraft!: WritableSignal<string>;
    @Input({ required: true }) isEditingDesc!: Signal<boolean>;
    @Input({ required: true }) descCharCount!: Signal<number>;

    @Input({ required: true }) startDescEdit!: () => void;
    @Input({ required: true }) saveDescription!: () => void;
    @Input({ required: true }) cancelDescEdit!: () => void;
    @Input({ required: true }) wrapSelection!: (el: HTMLTextAreaElement, left: string, right: string) => void;
    @Input({ required: true }) insertPrefix!: (el: HTMLTextAreaElement, prefix: string) => void;
    @Input({ required: true }) makeHeading!: (el: HTMLTextAreaElement) => void;
    @Input({ required: true }) insertLink!: (el: HTMLTextAreaElement) => void;
    @Input({ required: true }) richDescription!: (src: string | null | undefined) => string;

    @Input({ required: true }) PlusIcon!: any;
    @Input({ required: true }) PencilIcon!: any;
    @Input({ required: true }) BoldIcon!: any;
    @Input({ required: true }) ItalicIcon!: any;
    @Input({ required: true }) ListIcon!: any;
    @Input({ required: true }) Heading1Icon!: any;
    @Input({ required: true }) LinkIcon!: any;
}
