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

export interface DatabaseProvider<T extends Document = Document> {
  namespace: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  list(): Promise<string[]>
  collection(name: string): CollectionProvider<T>
  [key: string]: DatabaseProvider<T> | CollectionProvider<T> | string | (() => Promise<void>) | (() => Promise<string[]>) | ((name: string) => CollectionProvider<T>)
}

export type FilterQuery<T> = {
  [K in keyof T]?: T[K] | {
    $eq?: T[K],
    $gt?: T[K],
    $gte?: T[K],
    $lt?: T[K],
    $lte?: T[K],
    $in?: T[K][],
    $nin?: T[K][]
  }
}

export interface SearchOptions<T extends Document = Document> {
  filter?: FilterQuery<T>
  threshold?: number
  limit?: number
  offset?: number
  includeVectors?: boolean
}

export interface CollectionProvider<T extends Document = Document> {
  path: string
  find(filter: FilterQuery<T>, options?: SearchOptions<T>): Promise<T[]>
  search(query: string, options?: SearchOptions<T>): Promise<T[]>
  vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<T[]>
}
