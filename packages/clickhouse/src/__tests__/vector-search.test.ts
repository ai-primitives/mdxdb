import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClickHouseClient } from '../client'
import type { Config } from '../config'
import type { Document, DatabaseProvider } from '@mdxdb/types'

describe('ClickHouse Vector Search', () => {
  let client: DatabaseProvider<Document>
  const mockConfig: Config = {
    url: 'http://localhost:8123',
    username: 'default',
    password: '',
    database: 'test_db',
    oplogTable: 'oplog',
    dataTable: 'data',
    vectorIndexConfig: {
      type: 'hnsw',
      metric: 'cosineDistance',
      dimensions: 256
    }
  }

  beforeEach(async () => {
    client = await createClickHouseClient(mockConfig)
  })

  afterEach(async () => {
    await client.disconnect()
  })

  it('should perform vector search with threshold', async () => {
    const collection = 'test_collection'
    const vector = Array(256).fill(0.1)
    const options = {
      vector,
      collection,
      limit: 10,
      threshold: 0.7
    }

    const provider = await client
    const results = await provider.collections.vectorSearch(options)

    expect(Array.isArray(results)).toBe(true)
    expect(results.every(result =>
      typeof result.score === 'number' &&
      result.score >= 0 &&
      result.score <= 1
    )).toBe(true)
  })

  it('should include vectors in search results when requested', async () => {
    const collection = 'test_collection'
    const vector = Array(256).fill(0.1)
    const options = {
      vector,
      collection,
      limit: 10,
      threshold: 0.7,
      includeVectors: true
    }

    const provider = await client
    const results = await provider.collections.vectorSearch(options)

    expect(Array.isArray(results)).toBe(true)
    results.forEach(result => {
      expect(result.vector).toBeDefined()
      expect(Array.isArray(result.vector)).toBe(true)
      expect(result.vector).toHaveLength(256)
    })
  })

  it('should reject vectors with incorrect dimensions', async () => {
    const collection = 'test_collection'
    const vector = Array(128).fill(0.1) // Wrong dimensions
    const options = {
      vector,
      collection,
      limit: 10,
      threshold: 0.7
    }

    const provider = await client
    await expect(provider.collections.vectorSearch(options))
      .rejects
      .toThrow('Vector dimensions do not match configuration')
  })

  it('should handle vector search errors gracefully', async () => {
    const collection = 'invalid_collection'
    const vector = Array(256).fill(0.1)
    const options = {
      vector,
      collection,
      limit: 10,
      threshold: 0.7
    }

    const provider = await client
    await expect(provider.collections.vectorSearch(options))
      .rejects
      .toThrow('Method not implemented for vector search operation')
  })
})
