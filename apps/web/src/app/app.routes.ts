// apps/web/src/app/app.routes.ts
import {Router, Routes, UrlMatchResult, UrlSegment} from '@angular/router';
import { inject } from '@angular/core';
import { BoardPageComponent } from './pages/board-page.component';
import { AuthService } from './auth/auth.service';
import { BoardsService } from './data/boards.service';
import {UploadsBypassComponent} from "./shared/uploads-bypass.component";

/** Guard: block private area when not authenticated (await bootstrap on first run) */
const authGuard = async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.ensureBootstrapped();          // ✅ wait for /me or refresh to complete
    if (auth.isAuthed()) return true;

    return router.createUrlTree(['/login'], {
        queryParams: { next: location.pathname + location.search },
    });
};

/** Guard: resolve /b/_auto → first board id; otherwise route to login with hint */
const autoBoardGuard = async () => {
    const boards = inject(BoardsService);
    const router = inject(Router);

    try {
        const list = await boards.loadBoards({ autoSelect: false }); // should return Board[]
        // @ts-ignore
        const firstId = list?.[0]?.id as string | undefined;
        if (firstId) return router.createUrlTree(['/b', firstId]);

        // Authenticated but no boards yet — show gentle empty state via login hint (or your own page)
        return router.createUrlTree(['/login'], { queryParams: { noboards: 1 } });
    } catch {
        // Likely auth issue → send to login preserving intent
        return router.createUrlTree(['/login'], { queryParams: { next: '/b/_auto' } });
    }
};

// (optional) matcher if you want to support nested paths in /uploads/**:
export function uploadsMatcher(segments: UrlSegment[]): UrlMatchResult | null {
    if (!segments.length || segments[0].path !== 'uploads') return null;
    const rest = segments.slice(1).map(s => s.path).join('/');
    return { consumed: segments, posParams: { path: new UrlSegment(rest, {}) } };
}

export const routes: Routes = [
    // Public auth routes
    { path: 'login',    loadComponent: () => import('./auth/login.page').then(m => m.default),  title: 'Log in' },
    { path: 'register', loadComponent: () => import('./auth/register.page').then(m => m.default), title: 'Create account' },
    { path: 'forgot',   loadComponent: () => import('./auth/forgot.page').then(m => m.default),   title: 'Reset password' },

    // ✅ BYPASS /uploads/** BEFORE ANY GUARDED/SPA ROUTES
    { matcher: uploadsMatcher, component: UploadsBypassComponent },

    // Private area (guarded)
    {
        path: 'b',
        canMatch: [authGuard],                      // ✅ now safe on reload
        children: [
            { path: ':boardId', component: BoardPageComponent, title: 'Board' },
            { path: '_auto', canActivate: [autoBoardGuard], component: BoardPageComponent }, // never renders; guard redirects
        ],
    },

    { path: '', redirectTo: 'b/_auto', pathMatch: 'full' },
    { path: '**', redirectTo: 'b/_auto' },
];
