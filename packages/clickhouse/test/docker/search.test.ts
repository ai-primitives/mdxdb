import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createClient } from '@clickhouse/client-web'
import type { ClickHouseClient } from '@clickhouse/client-web'
import { dockerTestConfig } from '../docker.config'

interface TestRow {
  id: string
  content: string
  embedding: number[]
}

describe('ClickHouse Search Tests', () => {
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
          CREATE TABLE IF NOT EXISTS ${dockerTestConfig.database}.${dockerTestConfig.oplogTable} (
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
          CREATE MATERIALIZED VIEW IF NOT EXISTS ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
          ENGINE = MergeTree()
          ORDER BY (ns, timestamp)
          AS SELECT * FROM ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
        `
      })

      // Insert test data
      await client.exec({
        query: `
          INSERT INTO ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
          SELECT
            'test1' as id,
            'document' as type,
            'test' as ns,
            'hash1' as hash,
            '{"content": "test document"}' as data,
            [${Array(256).fill(0.1).join(',')}] as embedding,
            now() as timestamp
        `
      })
    } catch (error) {
      console.error('Failed to initialize database:', error)
      throw error
    }
  })

  afterAll(async () => {
    try {
      await client.exec({
        query: `TRUNCATE TABLE IF EXISTS ${dockerTestConfig.database}.${dockerTestConfig.dataTable}`
      })
      await client.close()
    } catch (error) {
      console.error('Failed to clean up:', error)
    }
  })

  test('full-text search works with exact match', async () => {
    const result = await client.query({
      query: `
        SELECT
          id,
          JSONExtractString(data, 'content') as content
        FROM ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
        WHERE JSONExtractString(data, 'content') = 'test document'
        LIMIT 1
      `,
      format: 'JSONEachRow'
    })
    const rows = await result.json() as TestRow[]
    expect(rows.length).toBe(1)
    expect(rows[0].content).toBe('test document')
  })

  test('full-text search works with LIKE operator', async () => {
    const result = await client.query({
      query: `
        SELECT *
        FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
        WHERE data LIKE '%test%'
        LIMIT 1
      `,
      format: 'JSONEachRow'
    })
    const rows = await result.json() as TestRow[]
    expect(rows.length).toBe(1)
  })

  test('full-text search returns empty result for non-matching content', async () => {
    const result = await client.query({
      query: `
        SELECT *
        FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
        WHERE data LIKE '%nonexistent%'
        LIMIT 1
      `,
      format: 'JSONEachRow'
    })
    const rows = await result.json() as TestRow[]
    expect(rows.length).toBe(0)
  })

  test('vector similarity search works with cosineDistance', async () => {
    const testVector = Array(256).fill(0.1)
    const result = await client.query({
      query: `
        SELECT *,
               cosineDistance(embedding, [${testVector.join(',')}]) as distance
        FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
        ORDER BY distance ASC
        LIMIT 1
      `,
      format: 'JSONEachRow'
    })
    const rows = await result.json() as (TestRow & { distance: number })[]
    expect(rows.length).toBe(1)
    expect(rows[0].distance).toBeCloseTo(0, 5)
  })

  test('vector similarity search returns results in ascending distance order', async () => {
    // Insert another test document with a different embedding
    await client.exec({
      query: `
        INSERT INTO mdxdb.oplog
        SELECT
          'test2' as id,
          'document' as type,
          'test' as ns,
          'hash2' as hash,
          '{"content": "another test"}' as data,
          [${Array(256).fill(0.5).join(',')}],
          now() as timestamp
      `
    })

    // Use a search vector that's closer to the first document (0.1) than the second (0.5)
    const searchVector = Array(256).fill(0.12)
    const result = await client.query({
      query: `
        SELECT
          id,
          cosineDistance(embedding, [${searchVector.join(',')}]) as distance
        FROM ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
        WHERE type = 'document'
        ORDER BY distance ASC
        LIMIT 2
      `,
      format: 'JSONEachRow'
    })
    const rows = await result.json() as { id: string; distance: number }[]
    expect(rows.length).toBe(2)
    expect(rows[0].distance).toBeLessThan(rows[1].distance)
  })
})
