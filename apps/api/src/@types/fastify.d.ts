// Source - https://stackoverflow.com/a
// Posted by 2conthanlancon
// Retrieved 2025-11-12, License - CC BY-SA 4.0

import * as http from 'http';

declare module 'fastify' {
    export interface FastifyInstance<
        HttpServer = http.Server,
        HttpRequest = http.IncomingMessage,
        HttpResponse = http.ServerResponse,
    > {
        authenticate(): void;
    }
}

