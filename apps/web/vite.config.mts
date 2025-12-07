import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
    console.log(`Building with mode: ${mode}`); // Debug log

    return {
        plugins: [
            angular({
                jit: false,
                tsconfig: resolve(__dirname, 'tsconfig.app.json'),
            }) as any,
            tsconfigPaths() as any
        ],
        resolve: {
            alias: {
                ...(mode === 'production' ? {
                    // Force replace the specific environment file
                    [resolve(__dirname, 'src/environments/environment.ts')]: resolve(__dirname, 'src/environments/environment.prod.ts'),
                } : {}),
            }
        },
        server: {
            port: 4200,
            proxy: {
                '/api': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    secure: false,
                }
            }
        },
        build: {
            modulePreload: false
        },
        test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: ['src/test-setup.ts'],
            include: ['**/*.spec.ts'],
            reporters: ['default'],
            pool: 'forks',
        },
    };
})
