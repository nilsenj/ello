// src/main.ts
import 'zone.js';
import '@angular/compiler'; // JIT compiler
import './styles.css';

import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import {HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi} from '@angular/common/http';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import {AuthHeaderInterceptor} from "./app/core/auth-header.interceptor";

bootstrapApplication(AppComponent, {
    providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthHeaderInterceptor, multi: true },
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
