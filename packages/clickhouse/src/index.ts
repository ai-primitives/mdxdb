import { type ClickHouseClient } from '@clickhouse/client-web'
import { createClickHouseClient } from './client'
import { type Config } from './config'
import { checkClickHouseVersion } from './utils'
import { type TableSchema } from './schema'

// Re-export types from @mdxdb/types
export type { Document, DatabaseProvider, CollectionProvider, SearchOptions, FilterQuery, VectorSearchOptions } from '@mdxdb/types'

// Export local types and functions
export { createClickHouseClient, checkClickHouseVersion }
export type { Config, ClickHouseClient, TableSchema }
