import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const guestGuard: CanActivateFn = async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.bootstrapped) await auth.bootstrap();
    if (!auth.isAuthed()) return true;
    router.navigate(['/']); // already logged in → home/boards
    return false;
};
