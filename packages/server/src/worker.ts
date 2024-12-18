import { createApp } from './core'
import type { ServerConfig, AppEnv } from './core'
import { createClickHouseClient } from '@mdxdb/clickhouse'
import type { ExecutionContext } from '@cloudflare/workers-types'

// Initialize ClickHouse client with worker-specific configuration
const initializeClickHouseClient = async (env: AppEnv['Bindings']) => {
  const url = env.CLICKHOUSE_URL || 'http://localhost:8123'
  return await createClickHouseClient({
    url,
    database: 'mdxdb',
    username: env.CLICKHOUSE_USERNAME || 'default',
    password: env.CLICKHOUSE_PASSWORD || '',
    oplogTable: 'oplog',
    dataTable: 'data',
    vectorIndexConfig: {
      type: 'hnsw',
      metric: 'cosineDistance',
      dimensions: 256
    }
  })
}

// Create server configuration
const createServerConfig = async (env: AppEnv['Bindings']): Promise<ServerConfig> => ({
  provider: 'clickhouse',
  clickhouse: await initializeClickHouseClient(env)
})

export type Env = AppEnv

export interface ExportedWorker {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const config = await createServerConfig(env.Bindings)
      const app = createApp(config)
      return app.fetch(request, env, ctx)
    } catch {
      return new Response(JSON.stringify({ error: 'Server configuration failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
} satisfies ExportedWorker
