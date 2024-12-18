import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClickHouseClient } from '../client'
import type { Config } from '../config'
import type { Document, DatabaseProvider } from '@mdxdb/types'

describe('ClickHouse Vector Search', () => {
  let client: DatabaseProvider<Document>
  const mockConfig: Config = {
    url: 'http://localhost:8123',
    nativePort: 9000,
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
    try {
      client = await createClickHouseClient(mockConfig)
    } catch (error) {
      console.error('Failed to create client:', error)
      throw error
    }
  })

  afterEach(async () => {
    if (client && typeof client.disconnect === 'function') await client.disconnect()
  })

  it('should perform vector search with threshold', async () => {
    const testDocs: Document[] = [
      {
        id: '1',
        type: 'test',
        data: { title: 'Test 1' },
        content: 'Test document 1',
        embeddings: Array(256).fill(0.1),
        collections: ['test_collection']
      },
      {
        id: '2',
        type: 'test',
        data: { title: 'Test 2' },
        content: 'Test document 2',
        embeddings: Array(256).fill(0.2),
        collections: ['test_collection']
      },
      {
        id: '3',
        type: 'test',
        data: { title: 'Test 3' },
        content: 'Test document 3',
        embeddings: Array(256).fill(0.3),
        collections: ['test_collection']
      }
    ]

    const provider = await client
    for (const doc of testDocs) {
      await provider.collections.add('test_collection', doc)
    }

    const options = {
      vector: Array(256).fill(0.1),
      collection: 'test_collection',
      limit: 10,
      threshold: 0.7
    }

    const results = await provider.collections.vectorSearch(options)

    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(result => {
      const doc = result.document
      return (
        typeof result.score === 'number' &&
        result.score >= 0 &&
        result.score <= 1 &&
        doc.id !== undefined &&
        doc.type === 'test' &&
        typeof doc.content === 'string' &&
        Array.isArray(doc.embeddings) &&
        doc.embeddings.length === 256
      )
    })).toBe(true)

    // Cleanup test data
    for (const result of results) {
      const docId = result.document.id
      if (docId) {
        await provider.collections.delete('test_collection', docId)
      }
    }
  })

  it('should include vectors in search results when requested', async () => {
    const testDocs: Document[] = [
      {
        id: '1',
        type: 'test',
        data: { title: 'Test 1' },
        content: 'Test document 1',
        embeddings: Array(256).fill(0.1),
        collections: ['test_collection']
      },
      {
        id: '2',
        type: 'test',
        data: { title: 'Test 2' },
        content: 'Test document 2',
        embeddings: Array(256).fill(0.2),
        collections: ['test_collection']
      }
    ]

    const provider = await client
    for (const doc of testDocs) {
      await provider.collections.add('test_collection', doc)
    }

    const options = {
      vector: Array(256).fill(0.1),
      collection: 'test_collection',
      limit: 10,
      threshold: 0.7,
      includeVectors: true
    }

    const results = await provider.collections.vectorSearch(options)

    expect(Array.isArray(results)).toBe(true)
    results.forEach(result => {
      const doc = result.document
      expect(doc.id).toBeDefined()
      expect(doc.type).toBe('test')
      expect(doc.content).toBeDefined()
      expect(doc.embeddings).toBeDefined()
      expect(Array.isArray(doc.embeddings)).toBe(true)
      expect(doc.embeddings).toHaveLength(256)
      expect(result.vector).toBeDefined()
      expect(Array.isArray(result.vector)).toBe(true)
      expect(result.vector).toHaveLength(256)
    })

    // Cleanup test data
    for (const result of results) {
      const docId = result.document.id
      if (docId) {
        await provider.collections.delete('test_collection', docId)
      }
    }
  })

  it('should reject vectors with incorrect dimensions', async () => {
    const vector = Array(128).fill(0.1) // Wrong dimensions
    const options = {
      vector,
      collection: 'test_collection',
      limit: 10,
      threshold: 0.7
    }

    const provider = await client
    await expect(provider.collections.vectorSearch(options))
      .rejects
      .toThrow('Vector dimensions do not match configuration')
  })

  it('should handle vector search errors gracefully', async () => {
    const vector = Array(256).fill(0.1)
    const options = {
      vector,
      collection: 'invalid_collection',
      limit: 10,
      threshold: 0.7
    }

    const provider = await client
    await expect(provider.collections.vectorSearch(options))
      .rejects
      .toThrow('Collection not found')
  })
})
