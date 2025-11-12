import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // If app initializer hasn’t finished yet, Router will wait (blocking initial nav).
    // So here we only need to check the state.
    return auth.isAuthed()
        ? true
        : router.createUrlTree(['/login'], { queryParams: { next: location.pathname + location.search }});
};
