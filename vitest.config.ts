import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Force sequential test execution to prevent resource exhaustion
    fileParallelism: false,
    poolOptions: {
      forks: {
        singleFork: true,
        maxForks: 1,
      },
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, './src/core'),
      '@application': resolve(__dirname, './src/application'),
      '@infrastructure': resolve(__dirname, './src/infrastructure'),
      '@interfaces': resolve(__dirname, './src/interfaces'),
      '@shared': resolve(__dirname, './src/shared'),
    },
  },
});