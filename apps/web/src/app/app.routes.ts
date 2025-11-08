// apps/web/src/app/app.routes.ts
import { Routes } from '@angular/router';
import { BoardPageComponent } from './pages/board-page.component';

export const routes: Routes = [
    { path: '', redirectTo: 'b/_auto', pathMatch: 'full' },
    { path: 'b/:boardId', component: BoardPageComponent },
    // _auto lets the page pick the first board and normalize the URL:
    { path: 'b/_auto', component: BoardPageComponent },
    { path: '**', redirectTo: 'b/_auto' },
];
