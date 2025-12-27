// src/main.ts
import 'zone.js';
import '@angular/compiler'; // JIT
import '@angular/localize/init';
import './styles.css';

import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter, UrlHandlingStrategy, withEnabledBlockingInitialNavigation } from '@angular/router';
import { APP_INITIALIZER, LOCALE_ID } from '@angular/core';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

// Use ONLY the refresh-aware interceptor.
// Remove the header-only interceptor to avoid duplicate Authorization headers.
import { AuthInterceptor } from './app/core/auth.interceptor';
import { AuthService } from './app/auth/auth.service';
import { IgnoreUploadsStrategy } from "./app/shared/ignore-uploads.strategy";
import { environment } from "@env";
import { APP_CONFIG } from "./app/core/app-config";
import { applyLocale, getStoredLocale } from './app/i18n/i18n';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';

// Run auth bootstrap before the app starts & before initial navigation.
function bootstrapAuth(auth: AuthService) {
    return () => auth.bootstrap(); // returns Promise<void>
}

const locale = applyLocale(getStoredLocale());
registerSW({ immediate: true });

const platform = Capacitor.getPlatform();
const isIOS = platform === 'ios'
    || /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = platform === 'android';
if (isIOS || isAndroid) {
    document.documentElement.classList.add('native-safe-area');
}
if (isIOS) {
    document.documentElement.classList.add('ios-safe-area');
}
if (isAndroid) {
    document.documentElement.classList.add('android-safe-area');
}

bootstrapApplication(AppComponent, {
    providers: [
        // Interceptors (DI style)
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },

        provideHttpClient(
            withInterceptorsFromDi(),
            withFetch(),
        ),

        provideRouter(
            routes,
            withEnabledBlockingInitialNavigation()
        ),

        provideAnimations(),

        // Make sure we know the user state before routes activate.
        { provide: APP_INITIALIZER, useFactory: bootstrapAuth, deps: [AuthService], multi: true },
        { provide: UrlHandlingStrategy, useClass: IgnoreUploadsStrategy },
        { provide: APP_CONFIG, useValue: environment },
        { provide: LOCALE_ID, useValue: locale },
    ],
}).catch(console.error);
