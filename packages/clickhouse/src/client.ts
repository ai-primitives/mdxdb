import { createClient, type ClickHouseClient } from '@clickhouse/client-web'
import type { DatabaseProvider, Document, CollectionProvider, SearchOptions, FilterQuery, VectorSearchOptions, SearchResult } from '@mdxdb/types'
import { type Config } from './config'
import { checkClickHouseVersion } from './utils'

interface ClickHouseRow {
  id: string
  type: string
  ns: string
  host: string
  path: string[]
  content: string
  data: Record<string, unknown>
  embedding: number[]
  version: number
  hash: Record<string, unknown>
  ts: number
  sign: number
}

class ClickHouseCollectionProvider implements CollectionProvider<Document> {
  constructor(
    public readonly path: string,
    private readonly client: ClickHouseClient,
    private readonly config: Config
  ) {
    void this.config.database
  }

  async create(collection: string): Promise<void> {
    // Since tables are pre-created in schema, this is effectively a no-op
    // We just verify the collection name is valid and tables exist
    if (!collection || typeof collection !== 'string') {
      throw new Error('Collection name must be a non-empty string')
    }

    try {
      // Verify tables exist by attempting a simple query
      await this.client.query({
        query: `
          SELECT 1 
          FROM ${this.config.database}.${this.config.dataTable} 
          WHERE 1=0 
          LIMIT 1
        `
      })
      return
    } catch (error) {
      throw new Error(`Failed to verify collection ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async get(collection: string): Promise<Document[]> {
    if (!collection || typeof collection !== 'string') {
      throw new Error('Collection name must be a non-empty string')
    }

    try {
      const result = await this.client.query({
        query: `
          SELECT 
            id,
            type,
            ns,
            host,
            path,
            data,
            content,
            embedding,
            ts,
            hash,
            version
          FROM ${this.config.database}.${this.config.dataTable}
          WHERE sign = 1
            AND ns = {collection:String}
          ORDER BY version DESC
        `,
        query_params: {
          collection
        }
      })

      const rows = await result.json() as ClickHouseRow[]
      if (!Array.isArray(rows)) {
        throw new Error('Unexpected response format: expected array')
      }

      return rows.map(row => {
        const doc: Document = {
          content: String(row.content || ''),
          data: typeof row.data === 'object' ? row.data as Record<string, unknown> : {},
          embeddings: Array.isArray(row.embedding) ? row.embedding.map(Number) : undefined,
          collections: [collection],
          metadata: {
            id: String(row.id),
            type: String(row.type),
            ns: String(row.ns),
            host: String(row.host),
            path: Array.isArray(row.path) ? row.path.map(String) : [],
            content: String(row.content || ''),
            data: typeof row.data === 'object' ? row.data as Record<string, unknown> : {},
            version: Number(row.version),
            hash: typeof row.hash === 'object' ? row.hash as Record<string, unknown> : {},
            ts: Number(row.ts)
          }
        }
        return doc
      })
    } catch (error) {
      throw new Error(`Failed to get documents from collection ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async add(collection: string, document: Document): Promise<void> {
    if (!collection || typeof collection !== 'string') {
      throw new Error('Collection name must be a non-empty string')
    }

    if (!document || typeof document !== 'object') {
      throw new Error('Document must be a valid object')
    }

    try {
      // Ensure document has metadata
      if (!document.metadata) {
        document.metadata = {}
      }
      
      const timestamp = Math.floor(Date.now() / 1000) // Convert to seconds for UInt32

      // Generate ID if not provided
      if (!document.metadata.id) {
        document.metadata.id = this.generateId(collection, timestamp)
      }

      // Extract document fields, using metadata for required fields
      const row = {
        id: document.metadata.id,
        type: document.metadata.type || 'document',
        ns: collection,
        host: document.metadata.host || '',
        path: Array.isArray(document.metadata.path) ? document.metadata.path : [],
        data: document.metadata.data || {},
        content: document.content || '',
        embedding: Array.isArray(document.embeddings) ? document.embeddings : [],
        ts: timestamp,
        hash: document.metadata.hash || {},
        version: document.metadata.version || 1,
        sign: 1
      }

      await this.client.query({
        query: `
          INSERT INTO ${this.config.database}.${this.config.oplogTable} (
            id,
            type,
            ns,
            host,
            path,
            data,
            content,
            embedding,
            ts,
            hash,
            version,
            sign
          ) VALUES (
            {id:String},
            {type:String},
            {ns:String},
            {host:String},
            {path:Array(String)},
            {data:JSON},
            {content:String},
            {embedding:Array(Float32)},
            {ts:UInt32},
            {hash:JSON},
            {version:UInt64},
            {sign:Int8}
          )
        `,
        query_params: row
      })
    } catch (error) {
      throw new Error(`Failed to add document to collection ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Helper function to generate document IDs
  private generateId(collection: string, timestamp: number): string {
    // Base62 encoding implementation for document IDs
    const base62chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    
    // Hash the namespace (collection) using a simple sum of char codes
    const namespaceHash = collection.split('').reduce((acc, char) => {
      return (acc + char.charCodeAt(0)) % 62
    }, 0)
    
    // Convert timestamp to base62
    const timestampBase62 = (() => {
      let num = timestamp
      let result = ''
      while (num > 0) {
        result = base62chars[num % 62] + result
        num = Math.floor(num / 62)
      }
      return result.padStart(6, '0') // Ensure consistent length
    })()
    
    // Add random suffix for uniqueness
    const randomSuffix = Array.from(
      { length: 4 },
      () => base62chars[Math.floor(Math.random() * 62)]
    ).join('')
    
    // Format: n{namespace}t{timestamp}r{random}
    // n = namespace marker, t = timestamp marker, r = random marker
    return `n${base62chars[namespaceHash]}t${timestampBase62}r${randomSuffix}`
  }

  async update(collection: string, id: string, document: Document): Promise<void> {
    if (!collection || typeof collection !== 'string') {
      throw new Error('Collection name must be a non-empty string')
    }

    if (!id || typeof id !== 'string') {
      throw new Error('Document ID must be a non-empty string')
    }

    if (!document || typeof document !== 'object') {
      throw new Error('Document must be a valid object')
    }

    // Ensure document has metadata with id
    if (!document.metadata) {
      document.metadata = {}
    }
    document.metadata.id = id

    try {
      // Get the current version of the document
      const currentResult = await this.client.query({
        query: `
          SELECT version
          FROM ${this.config.database}.${this.config.dataTable}
          WHERE id = {id:String}
            AND ns = {collection:String}
            AND sign = 1
          ORDER BY version DESC
          LIMIT 1
        `,
        query_params: {
          id: document.metadata.id,
          collection
        }
      })

      const currentRows = await currentResult.json() as { version: number }[]
      if (!Array.isArray(currentRows) || currentRows.length === 0) {
        throw new Error(`Document not found: ${id}`)
      }

      const currentVersion = Number(currentRows[0].version)
      const newVersion = currentVersion + 1
      const timestamp = Math.floor(Date.now() / 1000)

      const metadata = document.metadata || {}
      
      // Prepare the new document version
      const row = {
        id,
        type: metadata.type || 'document',
        ns: collection,
        host: metadata.host || '',
        path: Array.isArray(metadata.path) ? metadata.path : [],
        data: metadata.data || {},
        content: metadata.content || '',
        embedding: Array.isArray(document.embeddings) ? document.embeddings : [],
        ts: timestamp,
        hash: metadata.hash || {},
        version: newVersion,
        sign: 1
      }

      // Insert a row with sign=-1 to mark the old version as deleted
      await this.client.query({
        query: `
          INSERT INTO ${this.config.database}.${this.config.oplogTable} (
            id,
            type,
            ns,
            host,
            path,
            data,
            content,
            embedding,
            ts,
            hash,
            version,
            sign
          )
          SELECT
            id,
            type,
            ns,
            host,
            path,
            data,
            content,
            embedding,
            ${timestamp} as ts,
            hash,
            version,
            -1 as sign
          FROM ${this.config.database}.${this.config.dataTable}
          WHERE id = {id:String}
            AND ns = {collection:String}
            AND version = {version:UInt64}
            AND sign = 1
        `,
        query_params: {
          id,
          collection,
          version: currentVersion
        }
      })

      // Insert the new version
      await this.client.query({
        query: `
          INSERT INTO ${this.config.database}.${this.config.oplogTable} (
            id,
            type,
            ns,
            host,
            path,
            data,
            content,
            embedding,
            ts,
            hash,
            version,
            sign
          ) VALUES (
            {id:String},
            {type:String},
            {ns:String},
            {host:String},
            {path:Array(String)},
            {data:JSON},
            {content:String},
            {embedding:Array(Float32)},
            {ts:UInt32},
            {hash:JSON},
            {version:UInt64},
            {sign:Int8}
          )
        `,
        query_params: row
      })
    } catch (error) {
      throw new Error(`Failed to update document ${id} in collection ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async delete(collection: string, id: string): Promise<void> {
    if (!collection || typeof collection !== 'string') {
      throw new Error('Collection name must be a non-empty string')
    }

    if (!id || typeof id !== 'string') {
      throw new Error('Document ID must be a non-empty string')
    }

    try {
      // Get the current version of the document
      const currentResult = await this.client.query({
        query: `
          SELECT version
          FROM ${this.config.database}.${this.config.dataTable}
          WHERE id = {id:String}
            AND ns = {collection:String}
            AND sign = 1
          ORDER BY version DESC
          LIMIT 1
        `,
        query_params: {
          id: id,
          collection
        }
      })

      const currentRows = await currentResult.json() as { version: number }[]
      if (!Array.isArray(currentRows) || currentRows.length === 0) {
        throw new Error(`Document not found: ${id}`)
      }

      const currentVersion = Number(currentRows[0].version)
      const timestamp = Math.floor(Date.now() / 1000)

      // Insert a row with sign=-1 to mark the document as deleted
      await this.client.query({
        query: `
          INSERT INTO ${this.config.database}.${this.config.oplogTable} (
            id,
            type,
            ns,
            host,
            path,
            data,
            content,
            embedding,
            ts,
            hash,
            version,
            sign
          )
          SELECT
            id,
            type,
            ns,
            host,
            path,
            data,
            content,
            embedding,
            ${timestamp} as ts,
            hash,
            version,
            -1 as sign
          FROM ${this.config.database}.${this.config.dataTable}
          WHERE id = {id:String}
            AND ns = {collection:String}
            AND version = {version:UInt64}
            AND sign = 1
        `,
        query_params: {
          id,
          collection,
          version: currentVersion
        }
      })
    } catch (error) {
      throw new Error(`Failed to delete document ${id} from collection ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
