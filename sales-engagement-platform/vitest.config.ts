import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // Domain tests must never be order-dependent.
    sequence: { shuffle: true },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
      thresholds: {
        // Safety-critical domain logic (DNC, call transitions, guards) must be near-fully branch-covered.
        'src/domain/**': { branches: 95, functions: 100, lines: 95, statements: 95 },
      },
    },
  },
});
