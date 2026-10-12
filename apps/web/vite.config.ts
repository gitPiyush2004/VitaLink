import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The aliases are spelled out rather than read from tsconfig by a plugin. One
 * fewer piece of magic to explain, and this list changes about twice a year.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vitalink/contracts': fileURLToPath(
        new URL('../../packages/contracts/src/index.ts', import.meta.url),
      ),
      '@vitalink/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // The API is called through this proxy in development, so the browser makes
    // same-origin requests and the refresh cookie's SameSite=Strict still works.
    proxy: {
      '/api': {
        target: process.env['VITALINK_API_PROXY_TARGET'] ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
