import { inject, Injectable } from '@angular/core';
import {
    HttpClient,
    HttpEvent,
    HttpEventType,
    HttpRequest,
    HttpResponse,
} from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { APP_CONFIG } from "../core/app-config";

export type DownloadEvent =
    | { kind: 'progress'; percent: number }
    | { kind: 'done'; filename: string; blob: Blob }
    | { kind: 'other' };

export type AttachmentDto = {
    id: string;
    name: string | null;
    url: string;
    mime: string | null;
    size: number | null;
    isCover: boolean;
    createdAt: string;
    createdBy: string | null;
};

// Helper to always go through API:
function join(a: string, b: string) {
    return `${a.replace(/\/+$/, '')}/${b.replace(/^\/+/, '')}`;
}

function appendQuery(url: string, qp: string) {
    if (!qp) return url;
    return url.includes('?') ? `${url}&${qp.replace(/^\?/, '')}` : `${url}${qp.startsWith('?') ? qp : `?${qp}`}`;
}

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
    private http = inject(HttpClient);
    private cfg = inject(APP_CONFIG); // { apiOrigin, publicPrefix }

    list(cardId: string) {
        return this.http.get<AttachmentDto[]>(`/api/cards/${cardId}/attachments`, { withCredentials: true });
    }

    makeAttachmentUrlFactory() {

        return (a: AttachmentDto, opts?: { download?: boolean }): string => {
            const raw = `${a.url || ''}`;
            const isAbs = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || raw.startsWith('blob:');

            // Absolute URL (external) → just pass through
            if (isAbs) {
                return appendQuery(raw, opts?.download ? 'download=1' : '');
            }

            // Relative URL we stored (usually "/uploads/.....")
            const base = this.cfg.apiOrigin || ''; // '' in dev (proxy), absolute in prod
            const full = base ? join(base, raw) : raw;

            // Only meaningful for API endpoints. For /uploads it’s ignored by server, but harmless.
            return appendQuery(full, opts?.download ? 'download=1' : '');
        };
    }

    /**
     * Upload local file via multipart
     */
    upload(cardId: string, file: File, name?: string) {
        const form = new FormData();
        form.append('file', file, file.name);
        if (name) form.append('name', name);
        return this.http.post<AttachmentDto>(`/api/cards/${cardId}/attachments`, form, { withCredentials: true });
    }

    /**
     * Attach by external URL
     */
    attachUrl(cardId: string, url: string, name?: string, mime?: string, size?: number) {
        return this.http.post<AttachmentDto>(`/api/cards/${cardId}/attachments`, { url, name, mime, size }, { withCredentials: true });
    }

    /**
     * Optional: streaming progress (if you want a progress bar)
     */
    uploadWithProgress(cardId: string, file: File, name?: string) {
        const form = new FormData();
        form.append('file', file, file.name);
        if (name) form.append('name', name);

        const req = new HttpRequest('POST', `/api/cards/${cardId}/attachments`, form, {
            reportProgress: true,
        });
        return this.http.request(req) as unknown as import('rxjs').Observable<HttpEvent<AttachmentDto>>;
    }

    rename(id: string, name: string) {
        return this.http.patch<AttachmentDto>(`/api/attachments/${id}`, { name }, { withCredentials: true });
    }

    setCover(id: string) {
        return this.http.post<{ ok: true }>(`/api/attachments/${id}/cover`, {}, { withCredentials: true });
    }

    removeCover(id: string) {
        return this.http.delete<{ ok: true }>(`/api/attachments/${id}/cover`, { withCredentials: true });
    }

    delete(id: string) {
        return this.http.delete<void>(`/api/attachments/${id}`, { withCredentials: true });
    }

    /**
     * Absolute URL resolver (useful if SSR or need to copy/share)
     */
    resolveUrl(id: string) {
        return this.http.get<{ url: string }>(`/api/attachments/${id}/url`, { withCredentials: true });
    }

    /** If you ever need an absolute URL from API */
    resolveAbsoluteUrl(id: string) {
        return this.http.get<{ url: string }>(`/api/attachments/${id}/url`, { withCredentials: true }).pipe(map(r => r.url));
    }


    /** Parse filename from Content-Disposition */
    private parseFilename(disposition?: string | null): string {
        if (!disposition) return 'download';
        // RFC 5987 (filename*="UTF-8''...") first, then fallback to filename="..."
        const utf8 = /filename\*\s*=\s*UTF-8''([^;\r\n]+)/i.exec(disposition);
        if (utf8?.[1]) return decodeURIComponent(utf8[1]);
        const quoted = /filename\s*=\s*"([^"]+)"/i.exec(disposition);
        if (quoted?.[1]) return quoted[1];
        const bare = /filename\s*=\s*([^;\r\n]+)/i.exec(disposition);
        return bare?.[1] ?? 'download';
    }

    /**
     * Force a browser "Save as…" download for an attachment by id.
     * Uses cookie-based auth; set withCredentials=true if API is on another origin.
     */
    async download(id: string, opts?: { withCredentials?: boolean }): Promise<{ filename: string; blob: Blob }> {
        const url = `/api/attachments/${id}/file?download=1`;
        const res = await this.http.get(url, {
            responseType: 'blob',
            observe: 'response',
            withCredentials: !!opts?.withCredentials, // same-origin: not needed
        }).toPromise();

        const cd = res?.headers.get('Content-Disposition');
        const filename = this.parseFilename(cd);
        const blob = res!.body as Blob;

        // trigger "save"
        const link = document.createElement('a');
        const objUrl = URL.createObjectURL(blob);
        link.href = objUrl;
        link.download = filename || 'download';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objUrl);

        return { filename, blob };
    }

    /** Convenience: download by DTO */
    downloadAttachment(a: AttachmentDto, opts?: { withCredentials?: boolean }) {
        return this.download(a.id, opts);
    }

    saveDownload(id: string, opts?: { withCredentials?: boolean }) {
        return this.downloadWithProgress(id, opts).subscribe((e) => {
            if (e.kind === 'done') {
                const a = document.createElement('a');
                const url = URL.createObjectURL(e.blob);
                a.href = url;
                a.download = e.filename || 'download';
                a.click();
                URL.revokeObjectURL(url);
            }
        });
    }

    /**
     * Streamed download with progress (0-100). Emits progress and a final
     * `{ filename, blob }` when complete.
     */
    downloadWithProgress(
        id: string,
        opts?: { withCredentials?: boolean }
    ): Observable<DownloadEvent> {
        const url = `/api/attachments/${id}/file?download=1`;

        // Body type is for the REQUEST (we have none): null
        const req = new HttpRequest<null>('GET', url, {
            reportProgress: true,
            responseType: 'blob',               // response is a Blob
            withCredentials: !!opts?.withCredentials,
        });

        // Tell HttpClient what the RESPONSE body type will be
        return this.http.request<Blob>(req).pipe(
            map((evt: HttpEvent<Blob>): DownloadEvent => {
                switch (evt.type) {
                    case HttpEventType.DownloadProgress: {
                        const total = (evt as any).total ?? 0;
                        const loaded = (evt as any).loaded ?? 0;
                        const percent = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
                        return { kind: 'progress', percent };
                    }
                    case HttpEventType.Response: {
                        const res = evt as HttpResponse<Blob>;
                        const cd = res.headers.get('Content-Disposition');
                        const filename = this.parseFilename(cd);
                        return { kind: 'done', filename, blob: res.body! };
                    }
                    default:
                        return { kind: 'other' };
                }
            })
        );
    }

    /**
     * Open in a new tab (good for inline preview instead of forcing download).
     * Browser will send your session cookie automatically.
     */
    openInNewTab(id: string) {
        const url = `/api/attachments/${id}/file`; // no ?download=1
        window.open(url, '_blank', 'noopener');
    }
}
