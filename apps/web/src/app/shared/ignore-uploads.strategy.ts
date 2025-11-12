// apps/web/src/app/shared/ignore-uploads.strategy.ts
import { Injectable } from '@angular/core';
import { UrlHandlingStrategy, UrlTree } from '@angular/router';

@Injectable()
export class IgnoreUploadsStrategy implements UrlHandlingStrategy {
    shouldProcessUrl(url: UrlTree): boolean {
        // Don’t let the router touch /uploads/*
        return !url.toString().startsWith('/uploads/');
    }
    extract(url: UrlTree): UrlTree { return url; }
    merge(url: UrlTree): UrlTree { return url; }
}
