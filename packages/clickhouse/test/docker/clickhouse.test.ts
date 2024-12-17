import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@clickhouse/client-web'
import type { ClickHouseClient } from '@clickhouse/client-web'
import { dockerTestConfig } from '../docker.config'

interface VectorSearchResult {
  id: string
  distance: number
}

const isCI = process.env.CI === 'true'
describe.skipIf(isCI)('ClickHouse Docker Integration', () => {
  const client: ClickHouseClient = createClient({
    url: `${dockerTestConfig.protocol}://${dockerTestConfig.host}:${dockerTestConfig.port}`,
    database: dockerTestConfig.database,
    username: dockerTestConfig.username,
    password: dockerTestConfig.password,
    clickhouse_settings: {
      allow_experimental_json_type: 1
    }
  })

  beforeAll(async () => {
    // Initialize database and tables
    await client.exec({
      query: `
        CREATE DATABASE IF NOT EXISTS mdxdb;
        SET allow_experimental_json_type = 1;
      `
    })

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS mdxdb.oplog (
          id String,
          type String,
          ns String,
          hash String,
          data String,
          embedding Array(Float32),
          timestamp DateTime64(3)
        ) ENGINE = MergeTree()
        ORDER BY (ns, timestamp)
      `
    })

    await client.exec({
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS mdxdb.data
        ENGINE = MergeTree()
        ORDER BY (ns, timestamp)
        AS SELECT * FROM mdxdb.oplog
      `
    })
  })

  afterAll(async () => {
    await client.exec({ query: 'DROP DATABASE IF EXISTS mdxdb' })
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
      query: 'SHOW DATABASES LIKE \'mdxdb\'',
      format: 'JSONEachRow'
    })
    const rows = (await result.json()) as Array<{ name: string }>
    expect(rows.length).toBe(1)
    expect(rows[0]?.name).toBe('mdxdb')
  })

  it('should have required tables', async () => {
    const result = await client.query({
      query: 'SHOW TABLES FROM mdxdb',
      format: 'JSONEachRow'
    })
    const rows = (await result.json()) as Array<{ name: string }>
    const tableNames = rows.map(row => row?.name).filter(Boolean)
    expect(tableNames).toContain('oplog')
    expect(tableNames).toContain('data')
  })

  describe('Vector Search', () => {
    beforeAll(async () => {
      const now = new Date()
      const timestamp = now.toISOString().slice(0, 19).replace('T', ' ')

      // Insert test data
      await client.exec({
        query: `
          INSERT INTO mdxdb.oplog (id, type, ns, hash, data, embedding, timestamp)
          VALUES (
            'test1',
            'document',
            'test',
            'hash1',
            '{"test": "data"}',
            [${Array(256).fill(0.1).join(',')}],
            parseDateTimeBestEffort('${timestamp}')
          )
        `
      })

      // Wait for materialized view to process the data
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    it('should support vector search using cosineDistance', async () => {
      const searchEmbedding = Array(256).fill(0.1)
      const result = await client.query({
        query: `
          WITH [${searchEmbedding.join(',')}] AS search_embedding
          SELECT id, cosineDistance(search_embedding, embedding) as distance
          FROM mdxdb.data
          WHERE ns = 'test'
          ORDER BY distance ASC
          LIMIT 1
        `,
        format: 'JSONEachRow'
      })
      const rows = (await result.json()) as VectorSearchResult[]
      expect(rows.length).toBe(1)
      expect(typeof rows[0]?.distance).toBe('number')
      expect(rows[0]?.distance).toBeCloseTo(0, 5)
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
          WITH [0.1] AS search_embedding
          SELECT id, cosineDistance(search_embedding, embedding) as distance
          FROM mdxdb.data
          LIMIT 1
        `,
        format: 'JSONEachRow'
      })).rejects.toThrow()
    })
  })
})
