import { defineConfig } from 'vitest/config';

/**
 * One test runner for the whole monorepo.
 *
 * The path aliases are duplicated from tsconfig.base.json rather than derived
 * from it. That is deliberate: a plugin that reads tsconfig at runtime is one
 * more piece of magic to explain, and this list changes about twice a year.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/**/__tests__/**/*.test.ts', 'packages/**/__tests__/**/*.test.ts'],
    // brain has its own runner (pytest); eval notebooks are not tests.
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/brain/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Coverage is reported, not gamed. What matters is that `domain/` — the
      // pure business arithmetic — is covered, so those thresholds are the only
      // ones enforced.
      include: ['apps/api/src/modules/**/domain/**', 'apps/api/src/shared/**'],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
    },
  },
  resolve: {
    alias: {
      '@vitalink/contracts': new URL('packages/contracts/src/index.ts', import.meta.url).pathname,
      '@vitalink/connectors': new URL('packages/connectors/src/index.ts', import.meta.url).pathname,
      '@vitalink/graph': new URL('packages/graph/src/index.ts', import.meta.url).pathname,
      '@vitalink/ui': new URL('packages/ui/src/index.ts', import.meta.url).pathname,
      '@config': new URL('apps/api/src/config', import.meta.url).pathname,
      '@shared': new URL('apps/api/src/shared', import.meta.url).pathname,
      '@modules': new URL('apps/api/src/modules', import.meta.url).pathname,
    },
  },
});
