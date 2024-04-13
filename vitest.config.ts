import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      exclude: ['**/*.types.ts'],
      include: ['src/**/*.ts'],
    },
  },
});
