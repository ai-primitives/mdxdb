// Export public API
export * from './client'
export * from './schema'
export * from './utils'

// Re-export types from @mdxdb/types
export type { Document, DatabaseProvider, CollectionProvider, SearchOptions, FilterQuery, VectorSearchOptions } from '@mdxdb/types'

// Export local types
export type { ClickHouseConfig } from './types'
export type { MDXDBClickHouseClient as ClickHouseClient } from './client'
export type { TableSchema } from './schema'
