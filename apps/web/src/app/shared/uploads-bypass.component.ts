// apps/web/src/app/shared/uploads-bypass.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    standalone: true,
    selector: 'uploads-bypass',
    template: '' // no UI; we just jump to the file
})
export class UploadsBypassComponent implements OnInit {
    private route = inject(ActivatedRoute);

    ngOnInit() {
        const rest = (this.route.snapshot.params['path'] ?? '').toString();
        // Do a full navigation so the browser requests /uploads/** directly (not via Angular)
        window.location.href = `/uploads/${rest}`;
    }
}
