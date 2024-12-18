import { createClient, type ClickHouseClient } from '@clickhouse/client-web'
import type { DatabaseProvider, Document, CollectionProvider, SearchOptions, FilterQuery, VectorSearchOptions, SearchResult } from '@mdxdb/types'
import { type Config } from './config'
import { checkClickHouseVersion } from './utils'

class ClickHouseCollectionProvider implements CollectionProvider<Document> {
  constructor(
    public readonly path: string,
    private readonly client: ClickHouseClient,
    private readonly config: Config
  ) {
    void this.config.database
  }

  async create(collection: string): Promise<void> {
    void this.client
    throw new Error(`Method not implemented for collection: ${collection}`)
  }

  async get(collection: string): Promise<Document[]> {
    void this.client
    throw new Error(`Method not implemented for collection: ${collection}`)
  }



  async insert(collection: string, document: Document): Promise<void> {
    void this.client
    void document
    throw new Error(`Method not implemented for collection: ${collection}`)
  }

  async update(collection: string, filter: FilterQuery<Document>, document: Partial<Document>): Promise<void> {
    void this.client
    void document
    throw new Error(`Method not implemented for collection: ${collection}, filter: ${JSON.stringify(filter)}`)
  }

  async delete(collection: string, filter: FilterQuery<Document>): Promise<void> {
    void this.client
    throw new Error(`Method not implemented for collection: ${collection}, filter: ${JSON.stringify(filter)}`)
  }

  async find(filter: FilterQuery<Document>, options?: SearchOptions<Document>): Promise<Document[]> {
    void this.client
    void filter
    void options
    throw new Error('Method not implemented for find operation')
  }

  async findOne(collection: string, filter: FilterQuery<Document>): Promise<Document | null> {
    void this.client
    void filter
    throw new Error(`Method not implemented for collection: ${collection}, filter: ${JSON.stringify(filter)}`)
  }

  async search(query: string, options?: SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    void this.client
    void query
    void options
    throw new Error('Method not implemented for search operation')
  }

  async vectorSearch(options: VectorSearchOptions & SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    void this.client
    void options
    throw new Error('Method not implemented for vector search operation')
  }
}

class ClickHouseDatabaseProvider implements DatabaseProvider<Document> {
  readonly namespace: string
  public collections: CollectionProvider<Document>
  private readonly client: ClickHouseClient
  private readonly config: Config

  constructor(client: ClickHouseClient, config: Config) {
    this.namespace = `clickhouse://${config.url}`
    this.client = client
    this.config = config
    this.collections = new ClickHouseCollectionProvider('', client, config)
  }

  async connect(): Promise<void> {
    await checkClickHouseVersion(this.client)
  }

  async disconnect(): Promise<void> {
    // No explicit disconnect needed for ClickHouse web client
  }

  async list(): Promise<string[]> {
    return []
  }

  collection(name: string): CollectionProvider<Document> {
    return new ClickHouseCollectionProvider(name, this.client, this.config)
  }
}

export const createClickHouseClient = async (config: Config): Promise<DatabaseProvider<Document>> => {
  try {
    const client = createClient({
      host: config.url,
      username: config.username,
      password: config.password,
      database: config.database
    })

    const provider = new ClickHouseDatabaseProvider(client, config)
    await provider.connect()
    return provider
  } catch (error) {
    const enhancedError = error instanceof Error
      ? new Error(`Failed to create ClickHouse client: ${error.message}`)
      : new Error('Failed to create ClickHouse client: Unknown error')
    throw enhancedError
  }
}
