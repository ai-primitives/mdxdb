import { type ClickHouseClient } from '@clickhouse/client-web'
import { createClickHouseClient } from './client'
import { type Config, type VectorIndexConfig, configSchema, vectorIndexConfigSchema, getConfig } from './config'
import { checkClickHouseVersion } from './utils'
import { type TableSchema } from './schema'
import type { Document, DatabaseProvider, CollectionProvider, SearchOptions, FilterQuery, VectorSearchOptions } from '@mdxdb/types'

// Re-export types from @mdxdb/types
export type { Document, DatabaseProvider, CollectionProvider, SearchOptions, FilterQuery, VectorSearchOptions }

// Export local types and functions
export { createClickHouseClient, checkClickHouseVersion, configSchema, vectorIndexConfigSchema, getConfig }
export type { Config, VectorIndexConfig, ClickHouseClient, TableSchema }

// Export additional functionality
export * from './schema'
export * from './utils'
export * from './client'
