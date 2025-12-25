import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { SafeHtmlPipe } from '../../shared/safe-html.pipe';
import { CardsService } from '../../data/cards.service';
import { BoardStore } from '../../store/board-store.service';

@Component({
    standalone: true,
    selector: 'card-modal-description',
    imports: [CommonModule, FormsModule, LucideAngularModule, SafeHtmlPipe],
    templateUrl: './card-modal-description.component.html',
    styleUrls: ['./card-modal.component.css'],
})
export class CardModalDescriptionComponent implements OnChanges {
    private cardsApi = inject(CardsService);
    private store = inject(BoardStore);
    readonly tDescription = $localize`:@@cardModalDescription.title:Description`;
    readonly tAddDescription = $localize`:@@cardModalDescription.addDescription:Add a more detailed description...`;
    readonly tNoDescription = $localize`:@@cardModalDescription.noDescription:No description yet.`;
    readonly tEdit = $localize`:@@cardModalDescription.edit:Edit`;
    readonly tBold = $localize`:@@cardModalDescription.bold:Bold`;
    readonly tItalic = $localize`:@@cardModalDescription.italic:Italic`;
    readonly tList = $localize`:@@cardModalDescription.list:List`;
    readonly tHeading = $localize`:@@cardModalDescription.heading:Heading`;
    readonly tLink = $localize`:@@cardModalDescription.link:Link`;
    readonly tLinkText = $localize`:@@cardModalDescription.linkText:link text`;
    readonly tSave = $localize`:@@cardModalDescription.save:Save`;
    readonly tCancel = $localize`:@@cardModalDescription.cancel:Cancel`;
    readonly tCharacters = $localize`:@@cardModalDescription.characters:characters`;

    @Input({ required: true }) cardId!: string;
    @Input({ required: true }) canEdit!: boolean;
    @Input() description: string | null | undefined;
    @Output() descriptionSaved = new EventEmitter<string>();

    @Input({ required: true }) PlusIcon!: any;
    @Input({ required: true }) PencilIcon!: any;
    @Input({ required: true }) BoldIcon!: any;
    @Input({ required: true }) ItalicIcon!: any;
    @Input({ required: true }) ListIcon!: any;
    @Input({ required: true }) Heading1Icon!: any;
    @Input({ required: true }) LinkIcon!: any;

    descDraft = '';
    isEditingDesc = false;

    ngOnChanges(changes: SimpleChanges) {
        if (changes['description'] && !this.isEditingDesc) {
            this.descDraft = this.description ?? '';
        }
    }

    get descCharCount() {
        return (this.descDraft || '').length;
    }

    startDescEdit() {
        if (!this.canEdit) return;
        this.isEditingDesc = true;
    }

    cancelDescEdit() {
        this.descDraft = this.description ?? '';
        this.isEditingDesc = false;
    }

    async saveDescription() {
        if (!this.cardId) return;
        const next = (this.descDraft ?? '').trim();
        try {
            await this.cardsApi.patchCardExtended(this.cardId, { description: next || '' });
            this.store.patchCardLocally?.(this.cardId, { description: next } as any);
            this.descriptionSaved.emit(next);
        } catch (err) {
            console.error('Failed to save description', err);
        } finally {
            this.isEditingDesc = false;
        }
    }

    private textarea() {
        return document.querySelector<HTMLTextAreaElement>('textarea.cm-textarea');
    }

    wrapSelection(el: HTMLTextAreaElement, left: string, right: string) {
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = this.descDraft || '';
        const selected = val.slice(start, end);

        const isInnerWrapped = selected.startsWith(left) && selected.endsWith(right) && selected.length >= left.length + right.length;
        const isOuterWrapped =
            val.substring(start - left.length, start) === left &&
            val.substring(end, end + right.length) === right;

        let next: string;
        let newStart: number;
        let newEnd: number;

        if (isInnerWrapped) {
            const inner = selected.substring(left.length, selected.length - right.length);
            next = val.substring(0, start) + inner + val.substring(end);
            newStart = start;
            newEnd = start + inner.length;
        } else if (isOuterWrapped) {
            next = val.substring(0, start - left.length) + selected + val.substring(end + right.length);
            newStart = start - left.length;
            newEnd = end - left.length;
        } else {
            next = val.substring(0, start) + left + selected + right + val.substring(end);
            newStart = start + left.length;
            newEnd = end + left.length;
        }

        this.descDraft = next;
        queueMicrotask(() => {
            el.focus();
            el.setSelectionRange(newStart, newEnd);
        });
    }

    insertPrefix(el: HTMLTextAreaElement, prefix: string) {
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = this.descDraft || '';
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;

        const currentLineResult = val.substring(lineStart);
        if (currentLineResult.startsWith(prefix)) {
            const next = val.substring(0, lineStart) + val.substring(lineStart + prefix.length);
            this.descDraft = next;
            queueMicrotask(() => {
                el.focus();
                el.setSelectionRange(Math.max(lineStart, start - prefix.length), Math.max(lineStart, end - prefix.length));
            });
        } else {
            const next = val.slice(0, lineStart) + prefix + val.slice(lineStart);
            this.descDraft = next;
            queueMicrotask(() => {
                el.focus();
                el.setSelectionRange(start + prefix.length, end + prefix.length);
            });
        }
    }

    makeHeading(el: HTMLTextAreaElement) {
        this.insertPrefix(el, '# ');
    }

    insertLink(el: HTMLTextAreaElement) {
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = this.descDraft || '';
        const selected = val.slice(start, end) || this.tLinkText;
        const ins = `[${selected}](https://)`;
        const next = val.slice(0, start) + ins + val.slice(end);

        this.descDraft = next;
        queueMicrotask(() => {
            el.focus();
            const urlStart = start + 1 + selected.length + 2;
            const urlEnd = urlStart + 8;
            el.setSelectionRange(urlStart, urlEnd);
        });
    }

    private hasDom() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    private fallbackSanitize(html: string) {
        let out = html.replace(/<(script|style|iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, '');
        return out
            .replace(/\son\w+="[^"]*"/gi, '')
            .replace(/\son\w+='[^']*'/gi, '')
            .replace(/\shref="javascript:[^"]*"/gi, ' href="#"')
            .replace(/\shref='javascript:[^']*'/gi, " href='#'");
    }

    renderMarkdown(src: string | null | undefined) {
        let s = (src ?? '').replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]!));
        s = s.replace(/^\s*#{1,6}\s+(.*)$/gmi, '<h4>$1</h4>');
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/_(.+?)_/g, '<em>$1</em>');
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        s = s.replace(/(?:^|\n)(-\s+.*(?:\n-\s+.*)*)/g, block =>
            '<ul>' + block.trim().split('\n').map(line => line.replace(/^\-\s+(.+)$/, '<li>$1</li>')).join('') + '</ul>'
        );
        return s
            .split(/\n{2,}/)
            .map(p => (/^<(h4|ul)>/i.test(p) ? p : `<p>${p.replace(/\n/g, '<br/>')}</p>`))
            .join('\n');
    }

    private looksLikeHtml(s: string) {
        return /<([a-z][\w:-]*)(\s[^>]*)?>[\s\S]*<\/\1>|<([a-z][\w:-]*)(\s[^>]*)?\/>/i.test(s);
    }

    private sanitizeBasicHtml(input: string) {
        if (!this.hasDom()) return this.fallbackSanitize(input);
        const allowedTags = new Set([
            'p',
            'br',
            'pre',
            'code',
            'blockquote',
            'hr',
            'ul',
            'ol',
            'li',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'strong',
            'b',
            'em',
            'i',
            'u',
            's',
            'a',
            'span',
            'div',
        ]);
        const allowedAttrs: Record<string, Set<string>> = {
            a: new Set(['href', 'title', 'target', 'rel']),
            span: new Set([]),
            div: new Set([]),
        };
        const template = document.createElement('template');
        template.innerHTML = input;
        const out = document.createElement('div');
        const cloneNode = (node: Node, parent: HTMLElement) => {
            if (node.nodeType === Node.TEXT_NODE) {
                parent.appendChild(document.createTextNode(node.textContent ?? ''));
                return;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const tag = el.tagName.toLowerCase();
                if (!allowedTags.has(tag)) {
                    for (const child of Array.from(el.childNodes)) cloneNode(child, parent);
                    return;
                }
                const outEl = document.createElement(tag);
                const allowed = allowedAttrs[tag] ?? new Set<string>();
                for (const { name, value } of Array.from(el.attributes)) {
                    const n = name.toLowerCase();
                    if (!allowed.has(n)) continue;
                    if (tag === 'a' && n === 'href') {
                        if (!/^(https?:|mailto:)/i.test(value)) continue;
                        outEl.setAttribute('href', value);
                        outEl.setAttribute('target', '_blank');
                        outEl.setAttribute('rel', 'noopener noreferrer');
                        continue;
                    }
                    outEl.setAttribute(n, value);
                }
                for (const child of Array.from(el.childNodes)) cloneNode(child, outEl);
                parent.appendChild(outEl);
            }
        };
        for (const child of Array.from(template.content.childNodes)) cloneNode(child, out);
        return out.innerHTML;
    }

    richDescription(src: string | null | undefined) {
        const val = (src ?? '').trim();
        if (!val) return '';
        const html = this.looksLikeHtml(val) ? val : this.renderMarkdown(val);
        return this.sanitizeBasicHtml(html);
    }
}
