import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
    return {
        plugins: [
            angular({
                jit: false,
                tsconfig: fileURLToPath(new URL('./tsconfig.app.json', import.meta.url)) as string,
            }) as any,
            tsconfigPaths() as any
        ],
        resolve: {
            alias: {
                ...(mode === 'production' ? {
                    [fileURLToPath(new URL('./src/environments/environment.ts', import.meta.url))]:
                        fileURLToPath(new URL('./src/environments/environment.prod.ts', import.meta.url)),
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
        }
    };
})
