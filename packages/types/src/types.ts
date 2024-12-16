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

export interface DatabaseOptions {
  namespace: string
  baseUrl?: string
}

export interface CollectionOptions {
  path: string
  database: Database
}

export class Database {
  private options: DatabaseOptions

  constructor(options: DatabaseOptions) {
    this.options = options
  }

  collection(path: string): Collection {
    return new Collection({ path, database: this })
  }
}

export class Collection {
  private options: CollectionOptions

  constructor(options: CollectionOptions) {
    this.options = options
  }

  async find(filter: Record<string, unknown>): Promise<Document[]> {
    // Implementation will be provided by specific providers
    throw new Error('Method not implemented')
  }

  async search(query: string, filter?: Record<string, unknown>): Promise<Document[]> {
    // Implementation will be provided by specific providers
    throw new Error('Method not implemented')
  }

  async vectorSearch(options: VectorSearchOptions): Promise<Document[]> {
    // Implementation will be provided by specific providers
    throw new Error('Method not implemented')
  }
}
