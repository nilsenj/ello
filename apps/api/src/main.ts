import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import {PrismaClient} from '@prisma/client';
import {registerListRoutes} from './routes/lists.js';
import {registerBoardRoutes} from './routes/boards.js';
import {registerCardRoutes} from './routes/cards.js';
import {registerImportRoutes} from "./routes/import.js";
import {registerLabelRoutes} from "./routes/labels.js";
import authPlugin from './plugins/auth.js';

const prisma = new PrismaClient();

async function bootstrap() {
    const app = Fastify({logger: true});

    await app.register(fastifyCors, {origin: true});
    await app.register(authPlugin, { prisma });

    // Register routes
    await registerBoardRoutes(app, prisma);
    await registerListRoutes(app, prisma);
    await registerCardRoutes(app, prisma);
    await registerImportRoutes(app, prisma);
    await registerLabelRoutes(app, prisma);

    const port = Number(process.env.PORT || 3000);
    await app.listen({port, host: '0.0.0.0'});
    app.log.info(`API on http://localhost:${port}`);
}

bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
