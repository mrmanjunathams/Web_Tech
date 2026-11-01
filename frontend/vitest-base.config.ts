import { defineConfig } from 'vitest/config';

// Merged into the Angular unit-test builder's Vitest config (angular.json: test.options.runnerConfig).
export default defineConfig({
  test: {
    // Editor and component tests render real DOM; leave headroom on slower machines and CI.
    testTimeout: 30_000,
  },
});
