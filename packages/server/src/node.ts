import { serve } from '@hono/node-server'
import { createApp, type ServerConfig } from './core'
import { createClient } from '@mdxdb/clickhouse'
import { createDatabase } from '@mdxdb/fs'

export const startServer = async (config: ServerConfig) => {
  const app = createApp(config)

  // Initialize provider based on configuration
  if (config.provider === 'clickhouse' && !config.clickhouse) {
    config.clickhouse = createClient()
  } else if (config.provider === 'fs' && !config.fs) {
    config.fs = createDatabase({ basePath: './data' })
  }

  const port = process.env.PORT || 3000
  console.log(`Server starting on port ${port}`)
  serve({ fetch: app.fetch, port: Number(port) })
}
