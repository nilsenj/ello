import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
    name: 'safeHtml',
    standalone: true,
})
export class SafeHtmlPipe implements PipeTransform {
    constructor(private dom: DomSanitizer) {}

    transform(value: string | null | undefined): SafeHtml {
        // IMPORTANT: only trust content that YOU already sanitized
        return this.dom.bypassSecurityTrustHtml(value ?? '');
    }
}
