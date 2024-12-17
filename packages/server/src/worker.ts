import { createApp, type ServerConfig } from './core'
import { createClient } from '@mdxdb/clickhouse'
import type { KVNamespace } from '@cloudflare/workers-types'

export interface Env {
  MDXDB_KV: KVNamespace
  PROVIDER: string
}

const config: ServerConfig = {
  provider: 'clickhouse',
  clickhouse: createClient()
}

export default {
  fetch: createApp(config).fetch
}
