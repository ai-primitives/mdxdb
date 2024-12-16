import type { MDXLD } from 'mdxld'

export interface Document extends MDXLD {
  embeddings?: number[]
  collections?: string[]
}

export interface VectorSearchOptions {
  vector?: number[]
  query?: string
  filter?: Record<string, unknown>
  k?: number
  threshold?: number
}

export interface NamespaceOptions {
  defaultNamespace?: string
  enforceHttps?: boolean
  maxPathDepth?: number
  allowSubdomains?: boolean
}

export interface DatabaseOptions {
  namespace: string
  baseUrl?: string
  options?: NamespaceOptions
}

export interface CollectionOptions {
  path: string
  database: DatabaseProvider
}

export interface DatabaseProvider<T = any> {
  namespace: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  list(): Promise<string[]>
  collection(name: string): CollectionProvider<T>
  [key: string]: DatabaseProvider<T> | any
}

export interface FilterQuery<T> {
  [key: string]: any
  $eq?: any
  $gt?: any
  $gte?: any
  $lt?: any
  $lte?: any
  $in?: any[]
  $nin?: any[]
}

export interface SearchOptions<T = any> {
  filter?: FilterQuery<T>
  threshold?: number
  limit?: number
  offset?: number
  includeVectors?: boolean
}

export interface CollectionProvider<T = any> {
  path: string
  find(filter: FilterQuery<T>, options?: SearchOptions<T>): Promise<T[]>
  search(query: string, options?: SearchOptions<T>): Promise<T[]>
  vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<T[]>
}
