import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: process.env.CI ? ['lcov', 'cobertura', 'text'] : ['text'],
      reportsDirectory: 'reports/coverage',
    },
    reporters: process.env.CI
      ? [['junit', { outputFile: 'reports/junit.xml' }], 'verbose']
      : ['verbose'],
  },
})
