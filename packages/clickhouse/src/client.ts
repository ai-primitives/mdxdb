import { createClient, type ClickHouseClient } from '@clickhouse/client-web'
import type { DatabaseProvider, Document, CollectionProvider, SearchOptions, FilterQuery, VectorSearchOptions, SearchResult } from '@mdxdb/types'
import { type Config } from './config'
import { checkClickHouseVersion } from './utils'

export class ClickHouseCollectionProvider implements CollectionProvider<Document> {
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

  async add(collection: string, document: Document): Promise<void> {
    try {
      const query = {
        query: `
          INSERT INTO ${this.config.dataTable}
          (id, type, data, content, embedding, collection)
          VALUES
          ({id:String}, {type:String}, {data:JSON}, {content:String}, {embedding:Array(Float64)}, {collection:String})
        `,
        parameters: {
          id: document.id,
          type: document.type,
          data: JSON.stringify(document),
          content: document.content,
          embedding: document.embeddings,
          collection
        }
      }
      await this.client.query(query)
    } catch (error) {
      console.error('Failed to add document:', error)
      throw error instanceof Error
        ? error
        : new Error('Unknown error while adding document')
    }
  }

  async update(collection: string, id: string, document: Document): Promise<void> {
    void this.client
    void document
    throw new Error(`Method not implemented for collection: ${collection}, id: ${id}`)
  }

  async delete(collection: string, id: string): Promise<void> {
    try {
      const query = {
        query: `
          DELETE FROM ${this.config.dataTable}
          WHERE id = {id:String} AND collection = {collection:String}
        `,
        parameters: {
          id,
          collection
        }
      }
      await this.client.query(query)
    } catch (error) {
      console.error('Failed to delete document:', error)
      throw error instanceof Error
        ? error
        : new Error('Unknown error while deleting document')
    }
  }

  async find(filter: FilterQuery<Document>, options?: SearchOptions<Document>): Promise<Document[]> {
    void this.client
    void filter
    void options
    throw new Error('Method not implemented for find operation')
  }

  async search(query: string, options?: SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    void this.client
    void query
    void options
    throw new Error('Method not implemented for search operation')
  }

  async vectorSearch(options: VectorSearchOptions & SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    if (!options.vector) {
      throw new Error('Vector is required for vector search')
    }

    const { vector, collection, limit = 10, threshold = 0.7 } = options

    interface ClickHouseRow {
      id: string
      data: Document
      score: number
    }

    const query = {
      query: `
        SELECT id, data, cosineDistance(embedding, [${vector.join(',')}]) as score
        FROM ${this.config.dataTable}
        WHERE collection = {collection:String}
        HAVING score <= {threshold:Float64}
        ORDER BY score ASC
        LIMIT {limit:UInt32}
      `,
      format: 'JSONEachRow' as const,
      parameters: {
        collection,
        threshold,
        limit
      }
    }

    try {
      const resultSet = await this.client.query(query)
      const rawData = await resultSet.json<unknown>()
      const rows = Array.isArray(rawData) ? rawData as ClickHouseRow[] : []

      return rows.map((row) => {
        const result: SearchResult<Document> = {
          document: row.data,
          score: row.score
        }
        if (options.includeVectors) {
          result.vector = vector
        }
        return result
      })
    } catch (error) {
      console.error('Vector search failed:', error)
      throw error instanceof Error
        ? error
        : new Error('Unknown error during vector search')
    }
  }
}

export class ClickHouseDatabaseProvider implements DatabaseProvider<Document> {
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
