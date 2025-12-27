import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
    console.log(`Building with mode: ${mode}`); // Debug log

    return {
        plugins: [
            angular({
                jit: false,
                tsconfig: resolve(__dirname, 'tsconfig.app.json'),
            }) as any,
            tsconfigPaths() as any,
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['favicon.svg', 'assets/logo.svg'],
                manifest: {
                    name: 'ELLO',
                    short_name: 'ELLO',
                    start_url: '/',
                    display: 'standalone',
                    background_color: '#f1f2f4',
                    theme_color: '#0f6ad4',
                    icons: [
                        {
                            src: 'assets/logo.svg',
                            sizes: 'any',
                            type: 'image/svg+xml'
                        }
                    ]
                }
            })
        ],
        resolve: {
            alias: {
                '@env': mode === 'production'
                    ? resolve(__dirname, 'src/environments/environment.prod.ts')
                    : resolve(__dirname, 'src/environments/environment.ts'),
            }
        },
        server: {
            port: 4200,
            proxy: {
                '/api': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    secure: false,
                },
                '/uploads': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    secure: false,
                },
                '/socket.io': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    secure: false,
                    ws: true,
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
