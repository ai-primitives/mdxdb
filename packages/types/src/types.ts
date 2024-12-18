import type { MDXLD } from 'mdxld'

export interface Document extends MDXLD {
  embeddings?: number[]
  collections?: string[]
  metadata?: Record<string, unknown>
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
  collections: CollectionProvider<T>
  connect(): Promise<void>
  disconnect(): Promise<void>
  list(): Promise<string[]>
  collection(name: string): CollectionProvider<T>
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
  collection?: string
}

export interface SearchResult<T extends Document = Document> {
  document: T
  score: number
  vector?: number[]
}

export interface CollectionProvider<T extends Document = Document> {
  path: string
  create(collection: string): Promise<void>
  get(collection: string): Promise<T[]>
  insert(collection: string, document: T): Promise<void>
  update(collection: string, filter: FilterQuery<T>, document: Partial<T>): Promise<void>
  delete(collection: string, filter: FilterQuery<T>): Promise<void>
  find(filter: FilterQuery<T>, options?: SearchOptions<T>): Promise<T[]>
  findOne(collection: string, filter: FilterQuery<T>): Promise<T | null>
  search(query: string, options?: SearchOptions<T>): Promise<SearchResult<T>[]>
  vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<SearchResult<T>[]>
}
