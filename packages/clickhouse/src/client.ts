import { createClient, type ClickHouseClient } from '@clickhouse/client-web'
import { BaseDocument, DatabaseProvider, Document, CollectionProvider, SearchOptions, FilterQuery, VectorSearchOptions, SearchResult, FilterOperator } from '@mdxdb/types'
import { type Config } from './config.js'
import { checkClickHouseVersion } from './utils.js'

// Type alias for string filters (most common use case)
type StringFilter = FilterOperator<string>

class ClickHouseDocument extends BaseDocument {
  constructor(
    id: string,
    content: string,
    data: Record<string, unknown>,
    metadata: { type?: string } & Record<string, unknown>,
    embeddings?: number[],
    collections: string[] = []
  ) {
    super(id, content, {
      ...data,
      $id: id,
      $type: String(metadata.type || 'document')
    }, metadata, embeddings, collections)
  }
}

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
  readonly path: string

  constructor(
    path: string,
    private readonly client: ClickHouseClient,
    private readonly config: Config
  ) {
    this.path = path
    if (!config.host || !config.port) {
      throw new Error('ClickHouse host and port must be configured')
    }
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
            metadata,
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

      return rows.map(row => new ClickHouseDocument(
        String(row.id),
        String(row.content || ''),
        typeof row.data === 'object' ? {
          ...(row.data as Record<string, unknown>),
          $id: String(row.id),
          $type: String(row.type)
        } : {
          $id: String(row.id),
          $type: String(row.type)
        },
        {
          type: String(row.type),
          ns: String(row.ns),
          host: String(row.host),
          path: Array.isArray(row.path) ? row.path.map(String) : [],
          content: String(row.content || ''),
          data: typeof row.data === 'object' ? row.data as Record<string, unknown> : {},
          version: Number(row.version),
          hash: typeof row.hash === 'object' ? row.hash as Record<string, unknown> : {},
          ts: Number(row.ts)
        },
        Array.isArray(row.embedding) ? row.embedding.map(Number) : undefined,
        [collection]
      ))
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
      const timestamp = Math.floor(Date.now() / 1000) // Convert to seconds for UInt32

      // Initialize required fields
      document.id = document.id || this.generateId(collection, timestamp)
      document.content = document.content || ''
      document.data = {
        ...document.data,
        $id: document.id,
        $type: document.metadata?.type || 'document'
      }
      
      // Initialize metadata if not present
      if (!document.metadata) {
        document.metadata = {
          id: document.id,
          type: 'document',
          ts: timestamp
        }
      }

      // Extract document fields, using metadata for required fields
      const metadata = {
        type: document.metadata?.type || 'document',
        ns: collection,
        host: document.metadata?.host || '',
        path: Array.isArray(document.metadata?.path) ? document.metadata.path : [],
        data: document.metadata?.data || {},
        content: document.content || '',
        hash: document.metadata?.hash || {},
        ts: timestamp
      }

      // Prepare data with JSON-LD properties
      const data = {
        ...(document.data || {}),
        $id: document.id || this.generateId(collection, timestamp), // Add $id to data for querying
        $type: document.metadata?.type || 'document'
      }

      const row = {
        id: document.id || this.generateId(collection, timestamp), // Keep id at root level
        metadata: JSON.stringify(metadata),
        type: metadata.type,
        ns: collection,
        host: metadata.host,
        path: metadata.path,
        data,
        content: document.content || '',
        embedding: Array.isArray(document.embeddings) ? document.embeddings : [],
        ts: timestamp,
        hash: metadata.hash,
        version: document.metadata?.version || 1,
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

    // Update required fields
    document.id = id
    document.content = document.content || ''
    document.data = {
      ...document.data,
      $id: id,
      $type: document.metadata?.type || 'document'
    }
    
    // Initialize metadata if not present
    if (!document.metadata) {
      document.metadata = {
        id: document.id,
        type: 'document',
        ts: Math.floor(Date.now() / 1000)
      }
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
          id,
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
      
      // Prepare data with JSON-LD properties
      const data = {
        ...(metadata?.data || {}),
        $id: id, // Add $id to data for querying
        $type: metadata?.type || 'document'
      }

      // Prepare the new document version
      const row = {
        id, // Keep id at root level
        type: metadata?.type || 'document',
        ns: collection,
        host: metadata?.host || '',
        path: Array.isArray(metadata?.path) ? metadata.path : [],
        data,
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

  async find(filter: FilterQuery<Document>, options?: SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    try {
      const conditions: string[] = ['sign = 1']
      const params: Record<string, unknown> = {}

      if (filter) {
        // Handle top-level properties
        if (filter.id) {
          conditions.push('id = {id:String}')
          params.id = filter.id
        }

        // Handle data field JSON-LD properties
        if (filter.data) {
          const data = filter.data as Record<string, unknown>
          if (data.$id) {
            conditions.push('JSONExtractString(data, \'$id\') = {dataId:String}')
            params.dataId = data.$id
          }
          if (data.$type) {
            conditions.push('JSONExtractString(data, \'$type\') = {dataType:String}')
            params.dataType = data.$type
          }
          if (data.$context) {
            conditions.push('JSONExtractString(data, \'$context\') = {dataContext:String}')
            params.dataContext = data.$context
          }
        }

        // Handle metadata fields
        if (filter.metadata) {
          const metadata = filter.metadata
          // Check if metadata is a FilterOperator
          if ('$eq' in metadata || '$gt' in metadata || '$lt' in metadata) {
            // Handle FilterOperator case
            if ('type' in metadata) {
              const typeFilter = metadata.type as StringFilter
              if (typeFilter.$eq) {
                conditions.push('type = {type:String}')
                params.type = typeFilter.$eq
              }
            }
            if ('ns' in metadata) {
              const nsFilter = metadata.ns as StringFilter
              if (nsFilter.$eq) {
                conditions.push('ns = {ns:String}')
                params.ns = nsFilter.$eq
              }
            }
          } else {
            // Handle regular metadata object case
            if ('type' in metadata && metadata.type) {
              conditions.push('type = {type:String}')
              params.type = metadata.type
            }
            if ('ns' in metadata && metadata.ns) {
              conditions.push('ns = {ns:String}')
              params.ns = metadata.ns
            }
          }
        }
      }

      const query = `
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
        WHERE ${conditions.join(' AND ')}
        ${options?.limit ? `LIMIT ${options.limit}` : ''}
        ${options?.offset ? `OFFSET ${options.offset}` : ''}
      `

      const result = await this.client.query({
        query,
        query_params: params
      })

      const rows = await result.json() as ClickHouseRow[]
      
      return rows.map(row => {
        const doc = new ClickHouseDocument(
          String(row.id),
          String(row.content || ''),
          {
            ...(typeof row.data === 'object' ? row.data as Record<string, unknown> : {}),
            $id: String(row.id),
            $type: String(row.type)
          },
          {
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
          },
          Array.isArray(row.embedding) ? row.embedding.map(Number) : undefined,
          [this.path]
        )
        return {
          document: doc,
          score: 1.0,
          vector: Array.isArray(row.embedding) ? row.embedding.map(Number) : undefined
        }
      })
    } catch (error) {
      throw new Error(`Failed to find documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async search(query: string, options?: SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    try {
      const conditions: string[] = ['sign = 1']
      const params: Record<string, unknown> = {
        query: `%${query}%`
      }

      // Add text search conditions including JSON-LD properties
      conditions.push(`(
        content ILIKE {query:String} OR
        JSONExtractString(data, '$type') ILIKE {query:String} OR
        JSONExtractString(data, '$context') ILIKE {query:String}
      )`)

      // Add filter conditions if provided
      if (options?.filter) {
        if (options.filter.id) {
          conditions.push('id = {id:String}')
          params.id = options.filter.id
        }
        if (options.filter.metadata) {
          const metadata = options.filter.metadata
          // Check if metadata is a FilterOperator
          if ('$eq' in metadata || '$gt' in metadata || '$lt' in metadata) {
            if ('type' in metadata) {
              const typeFilter = metadata.type as StringFilter
              if (typeFilter.$eq) {
                conditions.push('type = {type:String}')
                params.type = typeFilter.$eq
              }
            }
          } else if ('type' in metadata && metadata.type) {
            conditions.push('type = {type:String}')
            params.type = metadata.type
          }
        }
      }

      const searchQuery = `
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
        WHERE ${conditions.join(' AND ')}
        ${options?.limit ? `LIMIT ${options.limit}` : ''}
        ${options?.offset ? `OFFSET ${options.offset}` : ''}
      `

      const result = await this.client.query({
        query: searchQuery,
        query_params: params
      })

      const rows = await result.json() as ClickHouseRow[]
      
      return rows.map(row => {
        const doc = new ClickHouseDocument(
          String(row.id),
          String(row.content || ''),
          {
            ...(typeof row.data === 'object' ? row.data as Record<string, unknown> : {}),
            $id: String(row.id),
            $type: String(row.type)
          },
          {
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
          },
          Array.isArray(row.embedding) ? row.embedding.map(Number) : undefined,
          [this.path]
        )
        return {
          document: doc as Document,
          score: 1
        }
      })
    } catch (error) {
      throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async vectorSearch(options: VectorSearchOptions & SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    if (!options.vector) {
      throw new Error('Vector is required for vector search')
    }

    try {
      const conditions: string[] = ['sign = 1']
      const params: Record<string, unknown> = {
        vector: options.vector
      }

      // Add filter conditions if provided
      if (options.filter) {
        if (options.filter.id) {
          conditions.push('id = {id:String}')
          params.id = options.filter.id
        }
        if (options.filter.metadata) {
          const metadata = options.filter.metadata
          // Check if metadata is a FilterOperator
          if ('$eq' in metadata || '$gt' in metadata || '$lt' in metadata) {
            if ('type' in metadata) {
              const typeFilter = metadata.type as StringFilter
              if (typeFilter.$eq) {
                conditions.push('type = {type:String}')
                params.type = typeFilter.$eq
              }
            }
          } else if ('type' in metadata && metadata.type) {
            conditions.push('type = {type:String}')
            params.type = metadata.type
          }
        }
        // Handle JSON-LD properties in data field
        if (options.filter.data) {
          const data = options.filter.data as Record<string, unknown>
          if (data.$type) {
            conditions.push('JSONExtractString(data, \'$type\') = {dataType:String}')
            params.dataType = data.$type
          }
        }
      }

      const searchQuery = `
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
          version,
          cosineDistance(embedding, {vector:Array(Float32)}) as score
        FROM ${this.config.database}.${this.config.dataTable}
        WHERE ${conditions.join(' AND ')}
          AND arrayExists(x -> isNotNull(x), embedding)
        ORDER BY score ASC
        ${options.limit ? `LIMIT ${options.limit}` : ''}
        ${options.offset ? `OFFSET ${options.offset}` : ''}
      `

      const result = await this.client.query({
        query: searchQuery,
        query_params: params
      })

      const rows = await result.json() as (ClickHouseRow & { score: number })[]
      
      return rows
        .filter(row => row.score <= (options.threshold || 1))
        .map(row => {
          const doc = new ClickHouseDocument(
            String(row.id),
            String(row.content || ''),
            {
              ...(typeof row.data === 'object' ? row.data as Record<string, unknown> : {}),
              $id: String(row.id),
              $type: String(row.type)
            },
            {
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
            },
            Array.isArray(row.embedding) ? row.embedding.map(Number) : undefined,
            [this.path]
          )
          return {
            document: doc as Document,
            score: row.score
          }
        })
    } catch (error) {
      throw new Error(`Failed to perform vector search: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

class ClickHouseDatabaseProvider implements DatabaseProvider<Document> {
  readonly namespace: string
  public collections: CollectionProvider<Document>
  private readonly client: ClickHouseClient
  private readonly config: Config

  constructor(client: ClickHouseClient, config: Config) {
    const hostUrl = config.host.startsWith('http') ? config.host : `http://${config.host}:${config.port || 8123}`
    this.namespace = `clickhouse://${hostUrl}`
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
      host: `http://${config.host}:${config.port}`,
      username: config.username,
      password: config.password,
      database: config.database,
      clickhouse_settings: config.clickhouse_settings
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
