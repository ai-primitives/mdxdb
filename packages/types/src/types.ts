import type { MDXLD } from './mdxld'

/**
 * Document interface representing a document in the database
 * @extends MDXLD Base interface for MDX content
 */
/**
 * Document interface representing a document in the database
 * @extends MDXLD Base interface for MDX content
 */
export interface Document extends MDXLD {
  /** Unique identifier for the document - required at root level for JSON-LD compatibility */
  id: string
  /** Document content - required by MDXLD */
  content: string
  /** Document data including JSON-LD properties - required by MDXLD */
  data: {
    /** JSON-LD identifier (duplicated from root id) */
    $id: string
    /** JSON-LD type */
    $type: string
    /** JSON-LD context */
    $context?: string | Record<string, unknown>
    /** Additional data properties */
    [key: string]: unknown
  }
  /** Optional vector embeddings for similarity search */
  embeddings?: number[]
  /** Optional list of collection names this document belongs to */
  collections?: string[]
  /** Required metadata for document tracking */
  metadata: {
    /** Document identifier - matches root id for consistency */
    id: string
    /** Document type - matches data.$type */
    type: string
    /** Optional timestamp */
    ts?: number
    /** Optional namespace */
    ns?: string
    /** Optional host information */
    host?: string
    /** Optional path segments */
    path?: string[]
    /** Optional content description */
    content?: string
    /** Optional additional metadata */
    data?: Record<string, unknown>
    /** Optional version number */
    version?: number
    /** Optional hash information */
    hash?: Record<string, unknown>
  }
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

export type FilterOperator<T> = {
  $eq?: T
  $gt?: T
  $gte?: T
  $lt?: T
  $lte?: T
  $in?: T[]
  $nin?: T[]
}

export type MetadataFilter = {
  type?: string | FilterOperator<string>
  ns?: string | FilterOperator<string>
  host?: string | FilterOperator<string>
  path?: string[] | FilterOperator<string[]>
  content?: string | FilterOperator<string>
  data?: Record<string, unknown> | FilterOperator<Record<string, unknown>>
  version?: number | FilterOperator<number>
  hash?: Record<string, unknown> | FilterOperator<Record<string, unknown>>
  ts?: number | FilterOperator<number>
} & {
  [key: string]: unknown
}

export type NestedFilterQuery<T> = {
  [P in keyof T]?: T[P] extends Record<string, unknown>
    ? FilterOperator<T[P]> | {
        [K in keyof T[P]]?: T[P][K] extends Record<string, unknown>
          ? FilterOperator<T[P][K]> | {
              [L in keyof T[P][K]]?: T[P][K][L] | FilterOperator<T[P][K][L]>
            }
          : T[P][K] | FilterOperator<T[P][K]>
      }
    : T[P] | FilterOperator<T[P]>
}

export type FilterQuery<T> = NestedFilterQuery<T> & {
  [P in keyof T]?: T[P] extends Record<string, unknown>
    ? P extends 'metadata'
      ? MetadataFilter
      : P extends 'data'
      ? {
          [K in keyof T[P]]?: T[P][K] extends Record<string, unknown>
            ? FilterOperator<T[P][K]> | {
                [L in keyof T[P][K]]?: T[P][K][L] | FilterOperator<T[P][K][L]>
              }
            : T[P][K] | FilterOperator<T[P][K]>
        }
      : T[P] | FilterOperator<T[P]>
    : T[P] | FilterOperator<T[P]>
} & {
  $and?: FilterQuery<T>[]
  $or?: FilterQuery<T>[]
  $not?: FilterQuery<T>
} & {
  [key: `data.${string}`]: unknown
  [key: `data.${string}.${string}`]: unknown
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
  add(collection: string, document: T): Promise<void>
  update(collection: string, id: string, document: T): Promise<void>
  delete(collection: string, id: string): Promise<void>
  find(filter: FilterQuery<T>, options?: SearchOptions<T>): Promise<T[]>
  search(query: string, options?: SearchOptions<T>): Promise<SearchResult<T>[]>
  vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<SearchResult<T>[]>
}
