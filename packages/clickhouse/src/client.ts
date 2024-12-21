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
  version: number
  hash: Record<string, unknown>
  ts: number
  sign: number
  embedding?: number[]
}

export class ClickHouseCollectionProvider implements CollectionProvider<Document> {
  public readonly path: string
  public readonly client: ClickHouseClient
  private readonly config: Config

  constructor(config: Config) {
    if (!config) {
      throw new Error('Configuration object must be provided')
    }

    // Validate required configuration
    const { database, host, port } = config
    if (!database) {
      throw new Error('Database name must be provided in config')
    }
    if (!host) {
      throw new Error('Host must be provided in config')
    }
    if (!port) {
      throw new Error('Port must be provided in config')
    }

    // Set configuration with defaults
    this.config = {
      ...config,
      protocol: config.protocol ?? 'http',
      username: config.username ?? 'default',
      password: config.password ?? '',
      dataTable: config.dataTable ?? 'data',
      oplogTable: config.oplogTable ?? 'oplog'
    }

    // Parse URL or use individual components
    const baseUrl = this.config.url || `${this.config.protocol}://${this.config.host}:${this.config.port}`
    this.path = `${baseUrl}/${this.config.database}`
    
    try {
      this.client = createClient({
        host: baseUrl,
        username: this.config.username,
        password: this.config.password,
        database: this.config.database,
        request_timeout: 10000 // 10s timeout
      })
    } catch (error: unknown) {
      throw new Error(`Failed to create ClickHouse client: ${error instanceof Error ? error.message : String(error)}`)
    }
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
      const timestamp = Math.floor(Date.now() / 1000) // Convert to seconds for UInt32

      // Initialize metadata with ID if not present
      if (!document.metadata) {
        document.metadata = {
          id: this.generateId(collection, timestamp),
          type: 'document',
          ts: timestamp
        }
      } else if (!document.metadata.id) {
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
      document.metadata = {
        id: id,
        type: 'document',
        ts: Math.floor(Date.now() / 1000)
      }
    } else {
      document.metadata.id = id
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
    if (!filter || typeof filter !== 'object') {
      throw new Error('Filter must be a valid object')
    }

    if (!options?.collection) {
      throw new Error('Collection name must be provided in options.collection')
    }

    try {
      // Build WHERE clause from filters
      const whereConditions = ['sign = 1', 'ns = {collection:String}']
      const queryParams: Record<string, unknown> = { collection: options.collection }

      // Helper function to handle operator conditions
      const handleOperator = (key: string, value: unknown, paramPrefix: string) => {
        const [field, ...subFields] = key.split('.')
        const jsonPath = subFields.length > 0 ? `.${subFields.join('.')}` : ''
        
        if (typeof value === 'object' && value !== null) {
          Object.entries(value).forEach(([op, opValue], opIndex) => {
            const paramName = `${paramPrefix}_${opIndex}`
            switch (op) {
              case '$eq':
                whereConditions.push(`JSONExtractString(${field}${jsonPath}) = {${paramName}:String}`)
                queryParams[paramName] = String(opValue)
                break
              case '$gt':
                whereConditions.push(`JSONExtractString(${field}${jsonPath}) > {${paramName}:String}`)
                queryParams[paramName] = String(opValue)
                break
              case '$gte':
                whereConditions.push(`JSONExtractString(${field}${jsonPath}) >= {${paramName}:String}`)
                queryParams[paramName] = String(opValue)
                break
              case '$lt':
                whereConditions.push(`JSONExtractString(${field}${jsonPath}) < {${paramName}:String}`)
                queryParams[paramName] = String(opValue)
                break
              case '$lte':
                whereConditions.push(`JSONExtractString(${field}${jsonPath}) <= {${paramName}:String}`)
                queryParams[paramName] = String(opValue)
                break
              case '$in':
                if (Array.isArray(opValue)) {
                  whereConditions.push(`JSONExtractString(${field}${jsonPath}) IN {${paramName}:Array(String)}`)
                  queryParams[paramName] = opValue.map(String)
                }
                break
              case '$nin':
                if (Array.isArray(opValue)) {
                  whereConditions.push(`JSONExtractString(${field}${jsonPath}) NOT IN {${paramName}:Array(String)}`)
                  queryParams[paramName] = opValue.map(String)
                }
                break
            }
          })
        } else {
          // Direct value comparison
          const paramName = paramPrefix
          whereConditions.push(`JSONExtractString(${field}${jsonPath}) = {${paramName}:String}`)
          queryParams[paramName] = String(value)
        }
      }

      // Process filter conditions
      Object.entries(filter).forEach(([key, value], index) => {
        handleOperator(key, value, `filter${index}`)
      })

      // Add limit and offset if provided in options
      const limit = options?.limit ? Math.max(1, Math.min(1000, options.limit)) : 1000
      const offset = options?.offset || 0

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
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY version DESC
          LIMIT {limit:UInt32}
          OFFSET {offset:UInt32}
        `,
        query_params: {
          ...queryParams,
          limit,
          offset
        }
      })

      const rows = await result.json() as ClickHouseRow[]
      if (!Array.isArray(rows)) {
        throw new Error('Unexpected response format: expected array')
      }

      const documents = rows.map(row => {
        const doc: Document = {
          content: String(row.content || ''),
          data: typeof row.data === 'object' ? row.data as Record<string, unknown> : {},
          embeddings: Array.isArray(row.embedding) ? row.embedding.map(Number) : undefined,
          collections: options.collection ? [options.collection] : [],
          metadata: {
            id: String(row.id),
            type: String(row.type || 'document'),
            ns: String(row.ns),
            host: String(row.host || ''),
            path: Array.isArray(row.path) ? row.path.map(String) : [],
            content: String(row.content || ''),
            data: typeof row.data === 'object' ? row.data as Record<string, unknown> : {},
            version: Number(row.version || 1),
            hash: typeof row.hash === 'object' ? row.hash as Record<string, unknown> : {},
            ts: Number(row.ts || Math.floor(Date.now() / 1000))
          }
        }
        return doc
      })
      return documents
    } catch (error) {
      throw new Error(`Failed to find documents in collection ${options.collection}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async search(query: string, options?: SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query must be a non-empty string')
    }

    if (!options?.collection) {
      throw new Error('Collection name must be provided in options.collection')
    }

    try {
      // Build WHERE clause from filters and search query
      const whereConditions = [
        'sign = 1',
        'ns = {collection:String}',
        '(content ILIKE {searchPattern:String} OR data.content ILIKE {searchPattern:String})'
      ]
      const queryParams: Record<string, unknown> = {
        collection: options.collection,
        searchPattern: `%${query}%`
      }

      // Add additional filters if provided
      if (options.filter) {
        Object.entries(options.filter).forEach(([key, value], index) => {
          const paramName = `filter${index}`
          if (Array.isArray(value)) {
            whereConditions.push(`data.${key} IN {${paramName}:Array(String)}`)
            queryParams[paramName] = value.map(String)
          } else if (typeof value === 'object' && value !== null) {
            Object.entries(value).forEach(([op, opValue], opIndex) => {
              const opParamName = `${paramName}_${opIndex}`
              switch (op) {
                case '$eq':
                  whereConditions.push(`data.${key} = {${opParamName}:String}`)
                  queryParams[opParamName] = String(opValue)
                  break
                case '$gt':
                  whereConditions.push(`data.${key} > {${opParamName}:String}`)
                  queryParams[opParamName] = String(opValue)
                  break
                case '$gte':
                  whereConditions.push(`data.${key} >= {${opParamName}:String}`)
                  queryParams[opParamName] = String(opValue)
                  break
                case '$lt':
                  whereConditions.push(`data.${key} < {${opParamName}:String}`)
                  queryParams[opParamName] = String(opValue)
                  break
                case '$lte':
                  whereConditions.push(`data.${key} <= {${opParamName}:String}`)
                  queryParams[opParamName] = String(opValue)
                  break
                case '$in':
                  if (Array.isArray(opValue)) {
                    whereConditions.push(`data.${key} IN {${opParamName}:Array(String)}`)
                    queryParams[opParamName] = opValue.map(String)
                  }
                  break
                case '$nin':
                  if (Array.isArray(opValue)) {
                    whereConditions.push(`data.${key} NOT IN {${opParamName}:Array(String)}`)
                    queryParams[opParamName] = opValue.map(String)
                  }
                  break
              }
            })
          } else {
            whereConditions.push(`data.${key} = {${paramName}:String}`)
            queryParams[paramName] = String(value)
          }
        })
      }

      // Add limit and offset if provided
      const limit = options?.limit ? Math.max(1, Math.min(1000, options.limit)) : 1000
      const offset = options?.offset || 0

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
            version,
            if(content ILIKE {searchPattern:String}, 1, 0) + if(data.content ILIKE {searchPattern:String}, 1, 0) as matchScore
          FROM ${this.config.database}.${this.config.dataTable}
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY matchScore DESC, version DESC
          LIMIT {limit:UInt32}
          OFFSET {offset:UInt32}
        `,
        query_params: {
          ...queryParams,
          limit,
          offset
        }
      })

      const rows = await result.json() as (ClickHouseRow & { matchScore: number })[]
      if (!Array.isArray(rows)) {
        throw new Error('Unexpected response format: expected array')
      }

      return rows.map(row => ({
        document: {
          content: String(row.content || ''),
          data: typeof row.data === 'object' ? row.data as Record<string, unknown> : {},
          embeddings: Array.isArray(row.embedding) ? row.embedding.map(Number) : undefined,
          collections: options.collection ? [options.collection] : [],
          metadata: {
            id: String(row.id),
            type: String(row.type || 'document'),
            ns: String(row.ns),
            host: String(row.host || ''),
            path: Array.isArray(row.path) ? row.path.map(String) : [],
            content: String(row.content || ''),
            data: typeof row.data === 'object' ? row.data as Record<string, unknown> : {},
            version: Number(row.version || 1),
            hash: typeof row.hash === 'object' ? row.hash as Record<string, unknown> : {},
            ts: Number(row.ts || Math.floor(Date.now() / 1000))
          }
        },
        score: row.matchScore
      }))
    } catch (error) {
      throw new Error(`Failed to search documents in collection ${options.collection}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async vectorSearch(options: VectorSearchOptions & SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    if (!options?.collection) {
      throw new Error('Collection name must be provided in options.collection')
    }

    if (!options.vector || !Array.isArray(options.vector)) {
      throw new Error('Vector must be provided as an array of numbers')
    }

    try {
      // Build WHERE clause from filters
      const whereConditions = ['sign = 1', 'ns = {collection:String}']
      const queryParams: Record<string, unknown> = {
        collection: options.collection,
        vector: options.vector
      }

      // Add additional filters if provided
      if (options.filter) {
        Object.entries(options.filter).forEach(([key, value], index) => {
          const paramName = `filter${index}`
          if (Array.isArray(value)) {
            whereConditions.push(`data.${key} IN {${paramName}:Array(String)}`)
            queryParams[paramName] = value.map(String)
          } else if (typeof value === 'object' && value !== null) {
            Object.entries(value).forEach(([op, opValue], opIndex) => {
              const opParamName = `${paramName}_${opIndex}`
              switch (op) {
                case '$eq':
                  whereConditions.push(`data.${key} = {${opParamName}:String}`)
                  queryParams[opParamName] = String(opValue)
                  break
                case '$gt':
                  whereConditions.push(`data.${key} > {${opParamName}:String}`)
                  queryParams[opParamName] = String(opValue)
                  break
                case '$gte':
                  whereConditions.push(`data.${key} >= {${opParamName}:String}`)
                  queryParams[opParamName] = String(opValue)
                  break
                case '$lt':
                  whereConditions.push(`data.${key} < {${opParamName}:String}`)
                  queryParams[opParamName] = String(opValue)
                  break
                case '$lte':
                  whereConditions.push(`data.${key} <= {${opParamName}:String}`)
                  queryParams[opParamName] = String(opValue)
                  break
                case '$in':
                  if (Array.isArray(opValue)) {
                    whereConditions.push(`data.${key} IN {${opParamName}:Array(String)}`)
                    queryParams[opParamName] = opValue.map(String)
                  }
                  break
                case '$nin':
                  if (Array.isArray(opValue)) {
                    whereConditions.push(`data.${key} NOT IN {${opParamName}:Array(String)}`)
                    queryParams[opParamName] = opValue.map(String)
                  }
                  break
              }
            })
          } else {
            whereConditions.push(`data.${key} = {${paramName}:String}`)
            queryParams[paramName] = String(value)
          }
        })
      }

      // Add embedding check
      whereConditions.push('embedding IS NOT NULL')

      // Add threshold if provided
      if (typeof options.threshold === 'number') {
        whereConditions.push('cosineDistance(embedding, {vector:Array(Float32)}) <= {threshold:Float32}')
        queryParams.threshold = options.threshold
      }

      // Add limit and offset if provided
      const limit = options?.limit ? Math.max(1, Math.min(1000, options.limit)) : 1000
      const offset = options?.offset || 0

      const result = await this.client.query({
        query: `
          WITH
            cosineDistance(embedding, {vector:Array(Float32)}) as distance
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
            distance,
            (1 - distance) as score
          FROM ${this.config.database}.${this.config.dataTable}
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY score DESC
          LIMIT {limit:UInt32}
          OFFSET {offset:UInt32}
        `,
        query_params: {
          ...queryParams,
          limit,
          offset
        }
      })

      const rows = await result.json() as (ClickHouseRow & { score: number })[]
      if (!Array.isArray(rows)) {
        throw new Error('Unexpected response format: expected array')
      }


      return rows.map(row => ({
        document: {
          content: String(row.content || ''),
          data: typeof row.data === 'object' ? row.data as Record<string, unknown> : {},
          embeddings: Array.isArray(row.embedding) ? row.embedding.map(Number) : undefined,
          collections: options.collection ? [options.collection] : [],
          metadata: {
            id: String(row.id),
            type: String(row.type || 'document'),
            ns: String(row.ns),
            host: String(row.host || ''),
            path: Array.isArray(row.path) ? row.path.map(String) : [],
            content: String(row.content || ''),
            data: typeof row.data === 'object' ? row.data as Record<string, unknown> : {},
            version: Number(row.version || 1),
            hash: typeof row.hash === 'object' ? row.hash as Record<string, unknown> : {},
            ts: Number(row.ts || Math.floor(Date.now() / 1000))
          }
        },
        score: row.score,
        vector: options.includeVectors && Array.isArray(row.embedding) ? row.embedding.map(Number) : undefined
      }))
    } catch (error) {
      throw new Error(`Failed to perform vector search in collection ${options.collection}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

export class ClickHouseDatabaseProvider implements DatabaseProvider<Document> {
  readonly namespace: string
  public collections: CollectionProvider<Document>

  constructor(private readonly config: Config) {
    const { host, port } = config.url
      ? (() => {
          const url = new URL(config.url)
          return {
            host: url.hostname,
            port: url.port ? parseInt(url.port, 10) : 8123
          }
        })()
      : {
          host: config.host,
          port: config.port
        }

    this.namespace = `clickhouse://${host}:${port}/${config.database}`
    this.collections = new ClickHouseCollectionProvider(config)
  }

  async connect(): Promise<void> {
    let protocol: string
    let host: string
    let port: number

    if (this.config.url) {
      const url = new URL(this.config.url)
      protocol = url.protocol.replace(':', '')
      host = url.hostname
      port = url.port ? parseInt(url.port, 10) : 8123
    } else {
      protocol = this.config.protocol
      host = this.config.host
      port = this.config.port
    }

    const client = createClient({
      host: `${protocol}://${host}:${port}`,
      username: this.config.username,
      password: this.config.password,
      database: this.config.database
    })
    await checkClickHouseVersion(client)
  }

  async disconnect(): Promise<void> {
    // No explicit disconnect needed for ClickHouse web client
  }

  async list(): Promise<string[]> {
    return []
  }

  collection(_name: string): CollectionProvider<Document> {
    // Name parameter is required by interface but not used in this implementation
    return new ClickHouseCollectionProvider(this.config)
  }
}

export const createClickHouseClient = async (config: Config): Promise<DatabaseProvider<Document>> => {
  try {
    const provider = new ClickHouseDatabaseProvider(config)
    await provider.connect()
    return provider
  } catch (error) {
    const enhancedError = error instanceof Error
      ? new Error(`Failed to create ClickHouse client: ${error.message}`)
      : new Error('Failed to create ClickHouse client: Unknown error')
    throw enhancedError
  }
}
