// apps/web/src/app/app.routes.ts
import {Router, Routes, UrlMatchResult, UrlSegment} from '@angular/router';
import {inject} from '@angular/core';
import {AuthService} from './auth/auth.service';
import {BoardsService} from './data/boards.service';
import {UploadsBypassComponent} from "./shared/uploads-bypass.component";

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

/** Guard: only super admins can access admin console */
const superAdminGuard = async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.ensureBootstrapped();
    if (auth.isAuthed() && auth.user()?.isSuperAdmin) return true;

    return router.createUrlTree(['/']);
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
                path: 'billing/return',
                loadComponent: () => import('./pages/billing-return.page').then(m => m.BillingReturnPageComponent),
                title: 'Billing'
            },
            {
                path: 'billing/mock',
                loadComponent: () => import('./pages/billing-mock.page').then(m => m.BillingMockPageComponent),
                title: 'Mock Checkout'
            },
            {
                path: 'b/:id/diagram',
                loadComponent: () => import('./ui/board-diagram/board-diagram.component').then(m => m.BoardDiagramComponent),
                title: 'Board Diagram'
            },
            {
                path: 'b/:boardId/table',
                loadComponent: () => import('./components/board-table-view/board-table-view.component')
                    .then(m => m.BoardTableViewComponent),
                title: 'Board Table'
            },
            {
                path: 'b/:boardId',
                loadComponent: () => import('./pages/board-page.component').then(m => m.BoardPageComponent),
                title: 'Board'
            },
            {
                path: 'admin',
                canMatch: [superAdminGuard],
                loadComponent: () => import('./pages/admin.page').then(m => m.AdminPageComponent),
                title: 'Admin'
            },
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
            {
                path: 'w/:workspaceId/ecommerce-fulfillment',
                loadComponent: () => import('./modules/fulfillment/fulfillment.page').then(m => m.FulfillmentPageComponent),
                children: [
                    { path: '', pathMatch: 'full', redirectTo: 'overview' },
                    {
                        path: 'overview',
                        loadComponent: () => import('./modules/fulfillment/fulfillment-overview.page')
                            .then(m => m.FulfillmentOverviewPageComponent),
                        title: 'E-commerce Fulfillment'
                    },
                    {
                        path: 'orders',
                        loadComponent: () => import('./modules/fulfillment/fulfillment-orders.page')
                            .then(m => m.FulfillmentOrdersPageComponent),
                        title: 'Fulfillment Orders'
                    },
                    {
                        path: 'sla',
                        loadComponent: () => import('./modules/fulfillment/fulfillment-sla.page')
                            .then(m => m.FulfillmentSlaPageComponent),
                        title: 'Fulfillment SLA'
                    },
                    {
                        path: 'integrations',
                        loadComponent: () => import('./modules/fulfillment/fulfillment-integrations.page')
                            .then(m => m.FulfillmentIntegrationsPageComponent),
                        title: 'Fulfillment Integrations'
                    },
                    {
                        path: 'reports',
                        loadComponent: () => import('./modules/fulfillment/fulfillment-reports.page')
                            .then(m => m.FulfillmentReportsPageComponent),
                        title: 'Fulfillment Reports'
                    }
                ]
            },
        ],
    },

    {path: '**', redirectTo: ''},
];
