import { serve } from '@hono/node-server'
import { createApp } from './core.js'
import type { ServerConfig } from './core.js'
import { createClickHouseClient } from '@mdxdb/clickhouse'
import { createDatabase } from '@mdxdb/fs'

export const startServer = async (config: ServerConfig = { provider: 'fs' }) => {
  // Initialize provider based on configuration
  if (config.provider === 'clickhouse' && !config.clickhouse) {
    config.clickhouse = await createClickHouseClient({
      host: 'localhost',
      port: 8123,
      database: 'mdxdb',
      username: 'default',
      password: '',
      oplogTable: 'oplog',
      dataTable: 'data'
    })
  } else if (config.provider === 'fs' && !config.fs) {
    config.fs = createDatabase({ basePath: './data' })
  }

  const app = createApp(config)
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000

  serve({ fetch: app.fetch, port })
  console.log(`Server running at http://localhost:${port}`)
}
