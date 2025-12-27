// apps/web/src/app/app.routes.ts
import {Router, Routes, UrlMatchResult, UrlSegment} from '@angular/router';
import {inject} from '@angular/core';
import {BoardPageComponent} from './pages/board-page.component';
import {AuthService} from './auth/auth.service';
import {BoardsService} from './data/boards.service';
import {UploadsBypassComponent} from "./shared/uploads-bypass.component";
import {BoardTableViewComponent} from "./components/board-table-view/board-table-view.component";

/** Guard: block private area when not authenticated (await bootstrap on first run) */
const authGuard = async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.ensureBootstrapped();          // ✅ wait for /me or refresh to complete
    if (auth.isAuthed()) return true;

    return router.createUrlTree(['/login'], {
        queryParams: {next: location.pathname + location.search},
    });
};

/** Guard: allow landing page only for guests */
const guestOnlyGuard = async () => {
    const auth = inject(AuthService);

    await auth.ensureBootstrapped();
    return !auth.isAuthed();
};

/** Guard: resolve /b/_auto → first board id; otherwise route to login with hint */
const autoBoardGuard = async () => {
    const boards = inject(BoardsService);
    const router = inject(Router);

    try {
        const list = await boards.loadBoards({autoSelect: false}); // should return Board[]
        // @ts-ignore
        const firstId = list?.[0]?.id as string | undefined;
        if (firstId) return router.createUrlTree(['/b', firstId]);

        // Authenticated but no boards yet — show gentle empty state via login hint (or your own page)
        return router.createUrlTree(['/login'], {queryParams: {noboards: 1}});
    } catch {
        // Likely auth issue → send to login preserving intent
        return router.createUrlTree(['/login'], {queryParams: {next: '/b/_auto'}});
    }
};

// (optional) matcher if you want to support nested paths in /uploads/**:
export function uploadsMatcher(segments: UrlSegment[]): UrlMatchResult | null {
    if (!segments.length || segments[0].path !== 'uploads') return null;
    const rest = segments.slice(1).map(s => s.path).join('/');
    return {consumed: segments, posParams: {path: new UrlSegment(rest, {})}};
}

export const routes: Routes = [
    // Public auth routes
    {path: 'login', loadComponent: () => import('./auth/login.page').then(m => m.default), title: 'Log in'},
    {
        path: 'register',
        loadComponent: () => import('./auth/register.page').then(m => m.default),
        title: 'Create account'
    },
    {path: 'forgot', loadComponent: () => import('./auth/forgot.page').then(m => m.default), title: 'Reset password'},
    {path: 'roadmap', loadComponent: () => import('./pages/roadmap.page').then(m => m.default), title: 'Product roadmap'},
    {path: 'privacy', loadComponent: () => import('./pages/privacy.page').then(m => m.default), title: 'Privacy'},

    // Public landing page (guests only)
    {
        path: '',
        pathMatch: 'full',
        canMatch: [guestOnlyGuard],
        loadComponent: () => import('./pages/landing.page').then(m => m.default),
        title: 'Your personal kanban alternative board'
    },

    // ✅ BYPASS /uploads/** BEFORE ANY GUARDED/SPA ROUTES
    {matcher: uploadsMatcher, component: UploadsBypassComponent},

    // Private area (guarded)
    // Private area (guarded)
    {
        path: '',
        canMatch: [authGuard],
        children: [
            {
                path: '',
                loadComponent: () => import('./pages/home-page/home-page.component').then(m => m.HomePageComponent),
                title: 'Boards'
            },
            {
                path: 'w/:workspaceId',
                loadComponent: () => import('./pages/home-page/home-page.component').then(m => m.HomePageComponent),
                title: 'Workspace'
            },
            {
                path: 'b/:id/diagram',
                loadComponent: () => import('./ui/board-diagram/board-diagram.component').then(m => m.BoardDiagramComponent),
                title: 'Board Diagram'
            },
            {
                path: 'b/:boardId/table',
                component: BoardTableViewComponent
            },
            {path: 'b/:boardId', component: BoardPageComponent, title: 'Board'},
            {
                path: 'w/:workspaceId/service-desk',
                loadComponent: () => import('./modules/service-desk/service-desk.page').then(m => m.ServiceDeskPageComponent),
                children: [
                    { path: '', pathMatch: 'full', redirectTo: 'overview' },
                    {
                        path: 'overview',
                        loadComponent: () => import('./modules/service-desk/service-desk-overview.page')
                            .then(m => m.ServiceDeskOverviewPageComponent),
                        title: 'Service Desk'
                    },
                    {
                        path: 'requests',
                        loadComponent: () => import('./modules/service-desk/service-desk-requests.page')
                            .then(m => m.ServiceDeskRequestsPageComponent),
                        title: 'Service Desk Requests'
                    },
                    {
                        path: 'sla',
                        loadComponent: () => import('./modules/service-desk/service-desk-sla.page')
                            .then(m => m.ServiceDeskSlaPageComponent),
                        title: 'Service Desk SLA'
                    },
                    {
                        path: 'integrations',
                        loadComponent: () => import('./modules/service-desk/service-desk-integrations.page')
                            .then(m => m.ServiceDeskIntegrationsPageComponent),
                        title: 'Service Desk Integrations'
                    },
                    {
                        path: 'reports',
                        loadComponent: () => import('./modules/service-desk/service-desk-reports.page')
                            .then(m => m.ServiceDeskReportsPageComponent),
                        title: 'Service Desk Reports'
                    }
                ]
            },
        ],
    },

    {path: '**', redirectTo: ''},
];
