import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['scripts/autodocs/**/*.ts'],
      exclude: ['scripts/autodocs/**/__tests__/**', 'scripts/autodocs/cli/**'],
    },
    testTimeout: 30000,
  },
});
