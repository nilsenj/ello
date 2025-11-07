import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    angular({
      jit: false,
      tsconfig: fileURLToPath(new URL('./tsconfig.app.json', import.meta.url)),
    }),
    tsconfigPaths()
  ],
  server: {
    port: 4200,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } }
  }
})
