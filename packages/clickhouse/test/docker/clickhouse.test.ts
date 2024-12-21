import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@clickhouse/client-web'
import type { ClickHouseClient } from '@clickhouse/client-web'
import { dockerTestConfig } from '../docker.config'

interface VectorSearchResult {
  id: string
  distance: number
}

describe('ClickHouse Docker Integration', () => {
  const client: ClickHouseClient = createClient({
    url: `${dockerTestConfig.protocol}://${dockerTestConfig.host}:${dockerTestConfig.port}`,
    database: dockerTestConfig.database,
    username: dockerTestConfig.username,
    password: dockerTestConfig.password,
    clickhouse_settings: {
      allow_experimental_json_type: 1,
      allow_experimental_full_text_index: 1,
      allow_experimental_vector_similarity_index: 1
    }
  })

  beforeAll(async () => {
    try {
      // Initialize database
      await client.exec({
        query: `CREATE DATABASE IF NOT EXISTS ${dockerTestConfig.database}`
      })

      await client.exec({
        query: `USE ${dockerTestConfig.database}`
      })

      // Initialize tables
      await client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS mdxdb.oplog (
            metadata JSON,
            type String,
            ns String,
            host String,
            path Array(String),
            data JSON,
            content String,
            embedding Array(Float32),
            ts UInt32,
            hash JSON,
            version UInt64
          ) ENGINE = MergeTree()
          ORDER BY (JSONExtractString(metadata, 'id'), version)
        `
      })

      await client.exec({
        query: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS mdxdb.data
          ENGINE = VersionedCollapsingMergeTree(sign, version)
          ORDER BY (JSONExtractString(metadata, 'id'), version)
          AS SELECT
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
            version,
            1 as sign
          FROM mdxdb.oplog
        `
      })
    } catch (error) {
      console.error('Failed to initialize database:', error)
      throw error
    }
  })

  afterAll(async () => {
    await client.exec({ query: `DROP DATABASE IF EXISTS ${dockerTestConfig.database}` })
    await client.close()
  })

  it('should connect to ClickHouse server', async () => {
    const result = await client.query({
      query: 'SELECT 1 as value',
      format: 'JSONEachRow'
    })
    const rows = (await result.json()) as Array<{ value: number }>
    expect(rows[0]?.value).toBe(1)
  })

  it('should have mdxdb database', async () => {
    const result = await client.query({
      query: `SHOW DATABASES LIKE '${dockerTestConfig.database}'`,
      format: 'JSONEachRow'
    })
    const rows = (await result.json()) as Array<{ name: string }>
    expect(rows.length).toBe(1)
    expect(rows[0]?.name).toBe('mdxdb')
  })

  it('should have required tables', async () => {
    const result = await client.query({
      query: `SHOW TABLES FROM ${dockerTestConfig.database}`,
      format: 'JSONEachRow'
    })
    const rows = (await result.json()) as Array<{ name: string }>
    const tableNames = rows.map(row => row?.name).filter(Boolean)
    expect(tableNames).toContain(dockerTestConfig.oplogTable)
    expect(tableNames).toContain(dockerTestConfig.dataTable)
  })

  describe('Document Operations', () => {
    beforeAll(async () => {
      // Insert test documents with JSON-LD properties
      await client.exec({
        query: `
          INSERT INTO mdxdb.oplog
          SELECT
            '{"id":"test1","type":"article","ts":"' || toString(now64()) || '"}' as metadata,
            'article' as type,
            'test' as ns,
            'hash1' as hash,
            '{"$id":"test1","$type":"article","$context":{"language":"en"},"title":"Test Article"}' as data,
            [${Array(256).fill(0.1).join(',')}] as embedding,
            now() as timestamp;

          INSERT INTO mdxdb.oplog
          SELECT
            '{"id":"test2","type":"blog","ts":"' || toString(now64()) || '"}' as metadata,
            'blog' as type,
            'test' as ns,
            'hash2' as hash,
            '{"$id":"test2","$type":"blog","$context":{"language":"es"},"title":"Test Blog"}' as data,
            [${Array(256).fill(0.2).join(',')}] as embedding,
            now() as timestamp;
        `
      })

      // Wait for materialized view to process the data
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    it('should preserve top-level id and handle JSON-LD properties', async () => {
      const result = await client.query({
        query: `
          SELECT
            id,
            type,
            data,
            metadata
          FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
          WHERE JSONExtractString(data, '$id') = 'test1'
        `,
        format: 'JSONEachRow'
      })
      const rows = await result.json() as Array<{ id: string; type: string; data: Record<string, unknown> }>
      expect(rows.length).toBe(1)
      expect(rows[0].id).toBe('test1')
      expect(rows[0].data.$id).toBe('test1')
      expect(rows[0].data.$type).toBe('article')
      expect(rows[0].data.$context).toEqual({ language: 'en' })
    })

    it('should support nested queries with dot notation', async () => {
      const result = await client.query({
        query: `
          SELECT
            id,
            data
          FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
          WHERE JSONExtractString(JSONExtractRaw(data, '$context'), 'language') = 'es'
        `,
        format: 'JSONEachRow'
      })
      const rows = await result.json() as Array<{ id: string; data: Record<string, unknown> }>
      expect(rows.length).toBe(1)
      expect(rows[0].id).toBe('test2')
      expect(rows[0].data.$context).toEqual({ language: 'es' })
    })
  })

  describe('Vector Search', () => {
    beforeAll(async () => {
      // Test data already inserted in Document Operations describe block
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    it('should support vector search with JSON-LD property filters', async () => {
      const result = await client.query({
        query: `
          SELECT
            JSONExtractString(metadata, 'id') as id,
            JSONExtractString(data, '$type') as docType,
            cosineDistance(embedding, [${Array(256).fill(0.1).join(',')}]) as distance
          FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
          WHERE JSONExtractString(data, '$type') = 'article'
          ORDER BY distance ASC
          LIMIT 1
        `,
        format: 'JSONEachRow'
      })
      const rows = await result.json() as Array<{ id: string; docType: string; distance: number }>
      expect(rows.length).toBe(1)
      expect(rows[0].docType).toBe('article')
      expect(rows[0].distance).toBeCloseTo(0, 2)
    })

    it('should handle empty result sets gracefully', async () => {
      const searchEmbedding = Array(256).fill(0.1)
      const result = await client.query({
        query: `
          WITH [${searchEmbedding.join(',')}] AS search_embedding
          SELECT JSONExtractString(metadata, 'id') as id, cosineDistance(search_embedding, embedding) as distance
          FROM mdxdb.data
          WHERE ns = 'nonexistent'
          ORDER BY distance ASC
          LIMIT 1
        `,
        format: 'JSONEachRow'
      })
      const rows = (await result.json()) as VectorSearchResult[]
      expect(rows.length).toBe(0)
    })

    it('should handle malformed embeddings gracefully', async () => {
      await expect(client.query({
        query: `
          SELECT
            JSONExtractString(metadata, 'id') as id,
            cosineDistance(embedding, [${Array(255).fill(0.1).join(',')}]) as distance
          FROM ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
          WHERE type = 'document'
          ORDER BY distance ASC
          LIMIT 1
        `,
        format: 'JSONEachRow'
      })).rejects.toThrow('Unknown expression identifier `id` in scope')
    })

    it('should support complex filters with JSON-LD properties', async () => {
      // Insert test document with numeric properties
      await client.exec({
        query: `
          INSERT INTO mdxdb.oplog
          SELECT
            '{"id":"test3","type":"product","ts":"' || toString(now64()) || '"}' as metadata,
            'product' as type,
            'test' as ns,
            'hash3' as hash,
            '{"$id":"test3","$type":"product","price":100,"rating":4.5}' as data,
            [${Array(256).fill(0.3).join(',')}] as embedding,
            now() as timestamp
        `
      })

      // Test numeric comparisons
      const result = await client.query({
        query: `
          SELECT
            JSONExtractString(metadata, 'id') as id,
            JSONExtractFloat64(JSONExtractRaw(data), 'price') as price,
            JSONExtractFloat64(JSONExtractRaw(data), 'rating') as rating
          FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
          WHERE JSONExtractFloat64(JSONExtractRaw(data), 'price') > 50
            AND JSONExtractFloat64(JSONExtractRaw(data), 'rating') >= 4.0
            AND JSONExtractString(JSONExtractRaw(data), '$type') = 'product'
        `,
        format: 'JSONEachRow'
      })
      const rows = await result.json() as Array<{ id: string; price: number; rating: number }>
      expect(rows.length).toBe(1)
      expect(rows[0].price).toBe(100)
      expect(rows[0].rating).toBe(4.5)
    })

    it('should handle error cases gracefully', async () => {
      // Test invalid JSON path
      await expect(client.query({
        query: `
          SELECT JSONExtractString(data, 'nonexistent.path') as value
          FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
          LIMIT 1
        `,
        format: 'JSONEachRow'
      })).resolves.toBeDefined()

      // Test invalid vector dimensions
      await expect(client.query({
        query: `
          SELECT cosineDistance(embedding, [${Array(257).fill(0.1).join(',')}]) as distance
          FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
          LIMIT 1
        `,
        format: 'JSONEachRow'
      })).rejects.toThrow()
    })
  })
})
