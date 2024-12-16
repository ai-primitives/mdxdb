import type { MDXLD } from 'mdxld'
import type { EmbeddingResult } from './embedding'

export interface Document extends MDXLD {
  embedding?: EmbeddingResult
  collections?: string[]
}

export interface VectorSearchOptions {
  vector?: number[]
  query?: string
  filter?: Record<string, unknown>
  k?: number
  threshold?: number
}

export interface DatabaseOptions {
  namespace: string
  baseUrl?: string
}

export interface CollectionOptions {
  path: string
  database: DatabaseProvider
}

export interface DatabaseProvider {
  namespace: string
  collection(path: string): CollectionProvider
}

export interface CollectionProvider {
  path: string
  find(filter: Record<string, unknown>): Promise<Document[]>
  search(query: string, filter?: Record<string, unknown>): Promise<Document[]>
  vectorSearch(options: VectorSearchOptions): Promise<Document[]>
}
