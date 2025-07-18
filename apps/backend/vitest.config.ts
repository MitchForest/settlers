import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      '__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'
    ],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000, // Longer timeout for database operations
    pool: 'forks',      // Use forks for better isolation with database tests
  },
}) 