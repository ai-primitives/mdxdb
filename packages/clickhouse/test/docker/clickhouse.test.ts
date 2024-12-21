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
            id UUID DEFAULT generateUUIDv4(),
            type String,
            ns String,
            host String,
            path Array(String),
            data JSON,
            content String,
            embedding Array(Float64),
            ts UInt32,
            hash JSON,
            version UInt64,
            sign Int8 DEFAULT 1,
            INDEX idx_content content TYPE full_text GRANULARITY 1,
            INDEX idx_embedding embedding TYPE vector_similarity('hnsw', 'cosineDistance')
          ) ENGINE = ReplacingMergeTree(sign)
          ORDER BY (id)
        `
      })

      await client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS mdxdb.data (
            id UUID,
            type String,
            ns String,
            host String,
            path Array(String),
            data JSON,
            content String,
            embedding Array(Float64),
            ts UInt32,
            hash JSON,
            version UInt64,
            sign Int8,
            INDEX idx_content content TYPE full_text GRANULARITY 1,
            INDEX idx_embedding embedding TYPE vector_similarity('hnsw', 'cosineDistance')
          ) ENGINE = ReplacingMergeTree(sign)
          ORDER BY (id)
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

  describe('Vector Search', () => {
    beforeAll(async () => {
      // Insert test data
      await client.exec({
        query: `
          INSERT INTO mdxdb.oplog
          SELECT
            'test1' as id,
            'document' as type,
            'test' as ns,
            'hash1' as hash,
            '{"test": "data"}' as data,
            [${Array(256).fill(0.1).join(',')}] as embedding,
            now() as timestamp
        `
      })

      // Wait for materialized view to process the data
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    it('should support vector search using cosineDistance', async () => {
      const result = await client.query({
        query: `
          SELECT
            id,
            cosineDistance(embedding, [${Array(256).fill(0.1).join(',')}]) as distance
          FROM ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
          WHERE type = 'document'
          ORDER BY distance ASC
          LIMIT 1
        `,
        format: 'JSONEachRow'
      })
      const rows = (await result.json()) as VectorSearchResult[]
      expect(rows.length).toBe(1)
      expect(typeof rows[0]?.distance).toBe('number')
      expect(rows[0]?.distance).toBeCloseTo(0, 2)
    })

    it('should handle empty result sets gracefully', async () => {
      const searchEmbedding = Array(256).fill(0.1)
      const result = await client.query({
        query: `
          WITH [${searchEmbedding.join(',')}] AS search_embedding
          SELECT id, cosineDistance(search_embedding, embedding) as distance
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
            id,
            cosineDistance(embedding, [${Array(255).fill(0.1).join(',')}]) as distance
          FROM ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
          WHERE type = 'document'
          ORDER BY distance ASC
          LIMIT 1
        `,
        format: 'JSONEachRow'
      })).rejects.toThrow()
    })
  })
})
