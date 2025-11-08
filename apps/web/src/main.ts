// src/main.ts
import 'zone.js';
import '@angular/compiler'; // JIT compiler
import './styles.css';

import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
    providers: [
        provideHttpClient(
            withInterceptorsFromDi(),
            withFetch(), // optional but nice for fetch-based HttpClient
        ),
        provideRouter(
            routes,
            withEnabledBlockingInitialNavigation()
        ),
        provideAnimations(),
    ],
}).catch(console.error);
