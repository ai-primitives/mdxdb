import type { MDXLD } from './mdxld'

export interface Document extends MDXLD {
  embeddings?: number[]
  collections?: string[]
  metadata: {
    id: string
    type?: string
    ns?: string
    host?: string
    path?: string[]
    content?: string
    data?: Record<string, unknown>
    version?: number
    hash?: Record<string, unknown>
    ts?: number
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

type DotPrefix<T extends string> = T extends '' ? '' : `.${T}`

type DotNestedKeys<T> = (T extends object ?
    { [K in Exclude<keyof T, symbol>]: `${K}${DotPrefix<DotNestedKeys<T[K]>>}` }[Exclude<keyof T, symbol>]
    : '') extends infer D ? Extract<D, string> : never

export type FilterQuery<T> = {
  [P in DotNestedKeys<T> | keyof T]?: P extends keyof T
    ? T[P] extends Record<string, any>
      ? FilterQuery<T[P]>
      : T[P] | {
          $eq?: T[P],
          $gt?: T[P],
          $gte?: T[P],
          $lt?: T[P],
          $lte?: T[P],
          $in?: T[P][],
          $nin?: T[P][]
        }
    : unknown | {
        $eq?: unknown,
        $gt?: unknown,
        $gte?: unknown,
        $lt?: unknown,
        $lte?: unknown,
        $in?: unknown[],
        $nin?: unknown[]
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
  add(collection: string, document: T): Promise<void>
  update(collection: string, id: string, document: T): Promise<void>
  delete(collection: string, id: string): Promise<void>
  find(filter: FilterQuery<T>, options?: SearchOptions<T>): Promise<T[]>
  search(query: string, options?: SearchOptions<T>): Promise<SearchResult<T>[]>
  vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<SearchResult<T>[]>
}
