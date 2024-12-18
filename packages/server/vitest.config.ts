import { defineConfig } from 'vitest/config'
import { workersPool } from '@cloudflare/vitest-pool-workers'

export default defineConfig({
  test: {
    pool: workersPool(),
    environment: 'miniflare',
    environmentOptions: {
      modules: true
    }
  }
})
