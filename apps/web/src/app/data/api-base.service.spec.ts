import { TestBed } from '@angular/core/testing';
import { ApiBaseService } from './api-base.service';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '@env';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ApiBaseService', () => {
    let service: ApiBaseService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                ApiBaseService,
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });
        service = TestBed.inject(ApiBaseService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should prepend apiOrigin to GET requests', async () => {
        const promise = service.get('/test-endpoint');
        const req = httpMock.expectOne(`${environment.apiOrigin}/test-endpoint`);
        expect(req.request.method).toBe('GET');
        expect(req.request.withCredentials).toBe(true);
        req.flush({ success: true });
        await promise;
    });

    it('should prepend apiOrigin to POST requests', async () => {
        const promise = service.post('/data', { foo: 'bar' });
        const req = httpMock.expectOne(`${environment.apiOrigin}/data`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ foo: 'bar' });
        req.flush({});
        await promise;
    });

    it('should prepend apiOrigin to PATCH requests', async () => {
        const promise = service.patch('/data/1', { foo: 'baz' });
        const req = httpMock.expectOne(`${environment.apiOrigin}/data/1`);
        expect(req.request.method).toBe('PATCH');
        req.flush({});
        await promise;
    });

    it('should prepend apiOrigin to DELETE requests', async () => {
        const promise = service.delete('/data/1');
        const req = httpMock.expectOne(`${environment.apiOrigin}/data/1`);
        expect(req.request.method).toBe('DELETE');
        req.flush({});
        await promise;
    });
});
