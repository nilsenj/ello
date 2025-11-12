// apps/web/src/app/uploads/uploads-viewer.page.ts
import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';

@Component({
    standalone: true,
    selector: 'uploads-viewer',
    imports: [CommonModule],
    template: `
  <div class="mx-auto max-w-5xl p-4 space-y-4">
    <div class="text-sm text-gray-500">File: <code>{{ fileName() }}</code></div>

    <ng-container [ngSwitch]="kind()">
      <img *ngSwitchCase="'image'" [src]="rawUrl()" class="max-w-full rounded shadow" alt="" />

      <video *ngSwitchCase="'video'" [src]="safeUrl()" controls class="w-full rounded shadow"></video>

      <audio *ngSwitchCase="'audio'" [src]="safeUrl()" controls class="w-full"></audio>

      <iframe *ngSwitchCase="'pdf'" [src]="safeUrl()" class="w-full h-[80vh] rounded shadow" title="PDF"></iframe>

      <div *ngSwitchDefault class="p-4 rounded border text-sm">
        <div>This file type isn’t previewable.</div>
        <div class="mt-2">
          <a [href]="rawUrl()" download class="underline">Download</a>
          <span class="mx-2">•</span>
          <a [href]="rawUrl()" target="_blank" rel="noopener" class="underline">Open in new tab</a>
        </div>
      </div>
    </ng-container>
  </div>
  `
})
export class UploadsViewerPage {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private sanitizer = inject(DomSanitizer);
    private http = inject(HttpClient);

    // If you used the matcher, param key is 'path'; if simple param, change to 'file'
    private param = this.route.snapshot.paramMap.get('path') ?? this.route.snapshot.paramMap.get('file') ?? '';

    // ── Source URL ──────────────────────────────────────────────────────────────
    // If you have a proxy (see Note below), /uploads/* will be proxied to your API.
    // Otherwise, change BASE to your API host (e.g. http://localhost:3333/uploads)
    private readonly BASE = '/uploads';
    rawUrl = computed(() => `${this.BASE}/${this.param}`);

    // ── Type detection ─────────────────────────────────────────────────────────
    private reImg = /\.(png|jpe?g|gif|webp|bmp|svg)(?:\?.*)?$/i;
    private reVid = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;
    private reAud = /\.(mp3|wav|ogg|m4a|flac)(?:\?.*)?$/i;
    private rePdf = /\.pdf(?:\?.*)?$/i;

    fileName = signal(this.param.split('/').pop() || '');

    kind = computed<'image'|'video'|'audio'|'pdf'|'other'>(() => {
        const url = this.rawUrl();
        if (this.reImg.test(url)) return 'image';
        if (this.reVid.test(url)) return 'video';
        if (this.reAud.test(url)) return 'audio';
        if (this.rePdf.test(url)) return 'pdf';
        return 'other';
    });

    // Angular complains if used directly in resource contexts; sanitize it.
    safeUrl(): SafeResourceUrl {
        const u = '/api' + this.rawUrl();
        const ok = /^(https?:|blob:|\/)/i.test(u);
        return this.sanitizer.bypassSecurityTrustResourceUrl(ok ? u : 'about:blank');
    }
}
