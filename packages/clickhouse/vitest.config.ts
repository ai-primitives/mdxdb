import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: false,
    isolate: true,
    env: {
      CI: process.env.CI || 'false'
    }
  }
})
