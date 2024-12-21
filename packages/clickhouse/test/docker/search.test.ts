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
          CREATE TABLE IF NOT EXISTS ${dockerTestConfig.database}.${dockerTestConfig.dataTable} (
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

      // Insert test data
      await client.exec({
        query: `
          INSERT INTO ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
          SELECT
            generateUUIDv4() as id,
            'document' as type,
            'test' as ns,
            'localhost' as host,
            ['test', 'docs'] as path,
            '{"content": "test document"}' as data,
            'test document' as content,
            [${Array(256).fill(0.1).join(',')}] as embedding,
            ${Math.floor(Date.now() / 1000)} as ts,
            '{"content":"hash1"}' as hash,
            1 as version,
            1 as sign
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
          generateUUIDv4() as id,
          'document' as type,
          'test' as ns,
          'localhost' as host,
          ['test', 'docs'] as path,
          '{"content": "another test"}' as data,
          'another test' as content,
          [${Array(256).fill(0.5).join(',')}] as embedding,
          ${Math.floor(Date.now() / 1000)} as ts,
          '{"content":"hash2"}' as hash,
          1 as version,
          1 as sign
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
