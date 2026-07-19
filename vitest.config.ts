import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: [
        'src/services/**/*.ts',
        'src/utils/**/*.ts',
        'src/theme/brand.ts',
      ],
      exclude: [
        'src/services/secureCredentials.ts', // OS keychain / web crypto; needs device
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
