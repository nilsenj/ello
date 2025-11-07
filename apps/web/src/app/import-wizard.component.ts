import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type ImportType = 'csv' | 'json';

@Component({
  selector: 'import-wizard',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="bg-white rounded-xl shadow p-6">
    <h2 class="text-xl font-semibold mb-4">Import Wizard</h2>
    <ol class="flex items-center mb-6">
      <li class="mr-4" [class.font-bold]="step()===1">1. Upload</li>
      <li class="mr-4" [class.font-bold]="step()===2">2. Map</li>
      <li [class.font-bold]="step()===3">3. Confirm</li>
    </ol>

    <ng-container [ngSwitch]="step()">
      <div *ngSwitchCase="1" class="space-y-4">
        <div class="space-x-2">
          <button class="px-3 py-1 rounded bg-gray-800 text-white" (click)="type.set('csv')">CSV</button>
          <button class="px-3 py-1 rounded bg-gray-200" (click)="type.set('json')">JSON</button>
          <span class="ml-2 text-sm text-gray-600">Selected: {{ type() }}</span>
        </div>
        <input type="file" (change)="onFile($event)" class="block" />
        <button [disabled]="!file()" class="px-4 py-2 bg-black text-white rounded" (click)="next()">Next</button>
      </div>

      <div *ngSwitchCase="2" class="space-y-3">
        <div class="text-sm text-gray-600">Preview first row mapping (demo):</div>
        <pre class="bg-gray-100 p-3 rounded text-xs">{{ preview() | json }}</pre>
        <button class="px-4 py-2 bg-black text-white rounded" (click)="next()">Next</button>
      </div>

      <div *ngSwitchCase="3" class="space-y-3">
        <p class="text-sm">Ready to import {{ type().toUpperCase() }}. (POST to /api/import/{{type()}})</p>
        <button class="px-4 py-2 bg-green-600 text-white rounded" (click)="confirm()">Import</button>
        <div *ngIf="result()" class="text-sm text-green-700">Result: {{ result() | json }}</div>
      </div>
    </ng-container>
  </div>
  `
})
export class ImportWizardComponent {
  step = signal(1);
  type = signal<ImportType>('csv');
  file = signal<File | null>(null);
  preview = signal<any>({});
  result = signal<any>(null);

  onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] || null;
    this.file.set(f);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (this.type() === 'json') {
        try { this.preview.set(JSON.parse(text)); } catch { this.preview.set({ error: 'Invalid JSON' }); }
      } else {
        const firstLine = text.split(/\r?\n/)[0];
        this.preview.set({ headers: firstLine.split(',') });
      }
    };
    reader.readAsText(f);
  }

  next() { this.step.set(this.step() + 1); }

  async confirm() {
    if (!this.file()) return;
    const form = new FormData();
    form.append('file', this.file()!);
    const res = await fetch(`/api/import/${this.type()}`, { method: 'POST', body: form });
    const data = await res.json();
    this.result.set(data);
  }
}
