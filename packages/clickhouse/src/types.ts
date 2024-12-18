/**
 * Type definitions for ClickHouse provider
 */
import type { Document } from '@mdxdb/types'

/**
 * Vector index configuration for HNSW
 */
export interface VectorIndexConfig {
  type: 'hnsw'
  metric: 'cosineDistance'
  dimensions: number
}

/**
 * Configuration options for ClickHouse client
 */
export interface ClickHouseConfig {
  url?: string
  username?: string
  password?: string
  database?: string
  oplogTable?: string
  dataTable?: string
  vectorIndexConfig?: VectorIndexConfig
}

/**
 * ClickHouse client interface
 */
export interface ClickHouseClient {
  config: ClickHouseConfig
  connect(): Promise<void>
  disconnect(): Promise<void>
  query<T = Document>(sql: string, params?: Record<string, unknown>): Promise<T[]>
}

/**
 * Hash map structure for document identifiers
 * Enables UUID-like functionality with decodable metadata
 */
export interface HashMap {
  /** Hash of the document ID */
  id: number
  /** Hash of the namespace */
  ns: number
  /** Array of path segment hashes */
  path: number[]
  /** Hash of the document data */
  data: number
  /** Hash of the document content */
  content: number
}
