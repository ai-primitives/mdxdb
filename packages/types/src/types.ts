import type { MDXLD } from './mdxld.js'
import type { FilterQuery } from './filter.js'

/**
 * Document interface representing a document in the database
 * Extends MDXLD base interface and adds document-specific functionality
 */
export interface Document extends MDXLD {
  /**
   * Get the document's unique identifier
   * @returns The document's ID
   */
  getId(): string

  /**
   * Get the document's type
   * @returns The document's type
   */
  getType(): string

  /**
   * Get the document's collections
   * @returns Array of collection names this document belongs to
   */
  getCollections(): string[]

  /**
   * Check if document belongs to a collection
   * @param collection Collection name to check
   * @returns True if document belongs to collection
   */
  belongsToCollection(collection: string): boolean

  /**
   * Get document's vector embeddings
   * @returns Vector embeddings if available
   */
  getEmbeddings(): number[] | undefined
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
  find(filter: FilterQuery<T>, options?: SearchOptions<T>): Promise<SearchResult<T>[]>
  search(query: string, options?: SearchOptions<T>): Promise<SearchResult<T>[]>
  vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<SearchResult<T>[]>
}
