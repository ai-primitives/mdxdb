import { createApp } from './core'
import type { ServerConfig, AppEnv } from './core'
import { createClient } from '@mdxdb/clickhouse'

// Initialize ClickHouse client with worker-specific configuration
const initializeClickHouseClient = (env: AppEnv['Bindings']) => {
  const url = env.CLICKHOUSE_URL || 'http://localhost:8123'
  return createClient(url, 'mdxdb-worker')
}

// Create server configuration
const createServerConfig = (env: AppEnv['Bindings']): ServerConfig => ({
  provider: 'clickhouse',
  clickhouse: initializeClickHouseClient(env)
})

export type Env = AppEnv

export interface ExportedWorker {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const config = createServerConfig(env.Bindings)
      const app = createApp(config)
      return app.fetch(request, env, ctx)
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Server configuration failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
} satisfies ExportedWorker
