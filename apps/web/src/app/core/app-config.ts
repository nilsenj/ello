import { InjectionToken } from '@angular/core';

export interface AppConfig {
    apiOrigin: string;      // e.g. '', 'https://api.example.com'
    publicPrefix: string;   // e.g. '/uploads'
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
