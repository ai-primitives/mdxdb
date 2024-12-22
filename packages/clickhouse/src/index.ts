import { type ClickHouseClient } from '@clickhouse/client-web'
import { createClickHouseClient } from './client.js'
import { type Config } from './config.js'
import { checkClickHouseVersion } from './utils.js'
import { type TableSchema } from './schema.js'

// Re-export types from @mdxdb/types
export type { Document, DatabaseProvider, CollectionProvider, SearchOptions, FilterQuery, VectorSearchOptions } from '@mdxdb/types'

// Export local types and functions
export { createClickHouseClient, checkClickHouseVersion }
export type { Config, ClickHouseClient, TableSchema }

// Export additional functionality
export * from './schema.js'
export * from './utils.js'
export * from './client.js'
