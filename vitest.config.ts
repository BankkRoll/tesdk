import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Type-only modules emit no runtime code and would otherwise report 0%.
      exclude: ['src/types/**', 'src/index.ts', 'src/auth/types.ts'],
      thresholds: { lines: 99, functions: 100, branches: 95, statements: 99 },
    },
  },
})
