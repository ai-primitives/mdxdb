import type { DatabaseProvider, Document, CollectionProvider, SearchOptions, FilterQuery, VectorSearchOptions, SearchResult } from '@mdxdb/types'
import { createClient as createBaseClient, ClickHouseClient } from '@clickhouse/client'

interface ClickHouseDocument {
  id: string
  content: string
  metadata: string
  data: string
  type?: string | undefined
  context?: string | undefined
  language?: string | undefined
  base?: string | undefined
  vocab?: string | undefined
  list?: string | undefined
  set?: string | undefined
  reverse?: string | undefined
  embeddings?: string | undefined
  collections?: string | undefined
}

interface ClickHouseSearchResult extends ClickHouseDocument {
  score: number
}

function parseDocument(row: ClickHouseDocument): Document {
  return {
    id: row.id,
    content: row.content,
    metadata: JSON.parse(row.metadata || '{}'),
    data: JSON.parse(row.data || '{}'),
    type: row.type,
    context: row.context ? JSON.parse(row.context) : undefined,
    language: row.language,
    base: row.base,
    vocab: row.vocab,
    list: row.list ? JSON.parse(row.list) : undefined,
    set: row.set ? new Set(JSON.parse(row.set)) : undefined,
    reverse: row.reverse === 'true',
    embeddings: row.embeddings ? JSON.parse(row.embeddings) : undefined,
    collections: row.collections ? JSON.parse(row.collections) : undefined
  }
}

function serializeDocument(document: Document): Omit<ClickHouseDocument, 'score'> {
  return {
    id: document.id || '',
    content: document.content,
    metadata: JSON.stringify(document.metadata || {}),
    data: JSON.stringify(document.data || {}),
    type: document.type,
    context: document.context ? JSON.stringify(document.context) : undefined,
    language: document.language,
    base: document.base,
    vocab: document.vocab,
    list: document.list ? JSON.stringify(document.list) : undefined,
    set: document.set ? JSON.stringify(Array.from(document.set)) : undefined,
    reverse: document.reverse ? 'true' : undefined,
    embeddings: document.embeddings ? JSON.stringify(document.embeddings) : undefined,
    collections: document.collections ? JSON.stringify(document.collections) : undefined
  }
}

export class MDXDBClickHouseClient implements DatabaseProvider<Document> {
  readonly namespace: string
  private client: ClickHouseClient
  public collections: CollectionProvider<Document>

  constructor(url: string = 'http://localhost:8123', namespace: string = 'default') {
    this.namespace = namespace
    this.client = createBaseClient({
      host: url,
      username: 'default',
      password: '',
      database: 'default'
    })

    this.collections = {
      path: `${namespace}/collections`,
      create: async (collection: string): Promise<void> => {
        await this.client.exec({
          query: `CREATE TABLE IF NOT EXISTS ${collection} (
            id String,
            content String,
            metadata String,
            data String,
            type String,
            context String,
            language String,
            base String,
            vocab String,
            list String,
            set String,
            reverse String,
            embeddings String,
            collections String,
            created_at DateTime DEFAULT now(),
            updated_at DateTime DEFAULT now()
          ) ENGINE = MergeTree()
          ORDER BY (id)`
        })
      },
      get: async (collection: string): Promise<Document[]> => {
        const result = await this.client.query({
          query: `SELECT * FROM ${collection}`
        })
        const rows = (await result.json()) as ClickHouseDocument[]
        return rows.map(parseDocument)
      },
      add: async (collection: string, document: Document): Promise<void> => {
        const values = [serializeDocument(document)]
        await this.client.insert({
          table: collection,
          values
        })
      },
      update: async (collection: string, id: string, document: Document): Promise<void> => {
        const values = serializeDocument(document)
        const updates = Object.entries(values)
          .map(([key, value]) => `${key} = ${value === null ? 'NULL' : `'${value}'`}`)
          .join(',\n')

        await this.client.exec({
          query: `ALTER TABLE ${collection} UPDATE
            ${updates},
            updated_at = now()
          WHERE id = '${id}'`
        })
      },
      delete: async (collection: string, id: string): Promise<void> => {
        await this.client.exec({
          query: `ALTER TABLE ${collection} DELETE WHERE id = '${id}'`
        })
      },
      find: async (_filter: FilterQuery<Document>, options?: SearchOptions<Document>): Promise<Document[]> => {
        const result = await this.client.query({
          query: `SELECT * FROM ${options?.collection || ''} LIMIT ${options?.limit || 10}`
        })
        const rows = (await result.json()) as ClickHouseDocument[]
        return rows.map(parseDocument)
      },
      search: async (query: string, options?: SearchOptions<Document>): Promise<SearchResult<Document>[]> => {
        const result = await this.client.query({
          query: `SELECT *, score FROM ${options?.collection || ''}
            WHERE match(content, '${query}')
            LIMIT ${options?.limit || 10}`
        })
        const rows = (await result.json()) as ClickHouseSearchResult[]
        return rows.map(row => ({
          document: parseDocument(row),
          score: row.score
        }))
      },
      vectorSearch: async (options: VectorSearchOptions & SearchOptions<Document>): Promise<SearchResult<Document>[]> => {
        if (!options.vector) {
          throw new Error('Vector is required for vector search')
        }
        return []
      }
    }
  }

  async connect(): Promise<void> {
    await this.client.ping()
  }

  async disconnect(): Promise<void> {
    await this.client.close()
  }

  collection(name: string): CollectionProvider<Document> {
    return {
      ...this.collections,
      path: `${this.namespace}/collections/${name}`
    }
  }

  async list(): Promise<string[]> {
    const result = await this.client.query({
      query: 'SHOW TABLES FROM mdxdb'
    })
    const rows = (await result.json()) as Array<{name: string}>
    return rows.map(row => row.name)
  }
}

export const createClient = (url?: string, namespace?: string): DatabaseProvider<Document> => {
  return new MDXDBClickHouseClient(url, namespace)
}
