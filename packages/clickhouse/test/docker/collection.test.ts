import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { ClickHouseCollectionProvider } from '../../src/client'
import { dockerTestConfig } from '../docker.config'
import type { Document, FilterQuery } from '@mdxdb/types'
import { randomUUID as crypto_randomUUID } from 'crypto'
import { createClient } from '@clickhouse/client'

describe('ClickHouseCollectionProvider', () => {
  let provider: ClickHouseCollectionProvider

  beforeAll(async () => {
    // Initialize provider with CI-compatible configuration
    const maxRetries = 15
    const retryInterval = 2000 // 2 seconds
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`${dockerTestConfig.protocol}://${dockerTestConfig.host}:${dockerTestConfig.port}/ping`)
        if (response.ok) {
          break
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error('ClickHouse server failed to start')
        }
        await new Promise(resolve => setTimeout(resolve, retryInterval))
      }
    }
    provider = new ClickHouseCollectionProvider({
      protocol: dockerTestConfig.protocol,
      host: dockerTestConfig.host,
      port: dockerTestConfig.port,
      database: dockerTestConfig.database,
      username: dockerTestConfig.username,
      password: dockerTestConfig.password,
      dataTable: dockerTestConfig.dataTable,
      oplogTable: dockerTestConfig.oplogTable,
      clickhouse_settings: {
        allow_experimental_json_type: 1,
        allow_experimental_full_text_index: 1,
        allow_experimental_vector_similarity_index: 1
      }
    })

    // Add test documents
    const testDocs: Document[] = [
      {
        content: 'Test document one',
        data: { category: 'test', priority: 'high' },
        embeddings: Array(256).fill(0.1),
        collections: ['test-collection'],
        metadata: {
          id: crypto_randomUUID(),
          type: 'document',
          ns: 'test-collection',
          host: 'localhost',
          path: ['test', 'docs'],
          content: 'Test document one',
          data: { category: 'test', priority: 'high' },
          version: 1,
          hash: { content: 'hash1' },
          ts: Math.floor(Date.now() / 1000)
        }
      },
      {
        content: 'Test document two',
        data: { category: 'test', priority: 'low' },
        embeddings: Array(256).fill(0.5),
        collections: ['test-collection'],
        metadata: {
          id: crypto_randomUUID(),
          type: 'document',
          ns: 'test-collection',
          host: 'localhost',
          path: ['test', 'docs'],
          content: 'Test document two',
          data: { category: 'test', priority: 'low' },
          version: 1,
          hash: { content: 'hash2' },
          ts: Math.floor(Date.now() / 1000)
        }
      }
    ]

    for (const doc of testDocs) {
      await provider.add('test-collection', doc)
    }
  })

  afterAll(async () => {
    // Clean up test documents using provider's delete method
    try {
      const docs = await provider.get('test-collection')
      for (const doc of docs) {
        // Ensure doc has required metadata before deletion
        if (doc?.metadata?.id && typeof doc.metadata.id === 'string') {
          await provider.delete('test-collection', doc.metadata.id)
        }
      }
    } catch (error) {
      console.error('Failed to clean up test documents:', error instanceof Error ? error.message : String(error))
    }
  })

  describe('find', () => {
    test('should find documents by exact match', async () => {
      const docs = await provider.find(
        { 'metadata.data.priority': 'high' } as FilterQuery<Document>,
        { collection: 'test-collection' }
      )
      expect(docs).toHaveLength(1)
      expect(docs[0].data.priority).toBe('high')
    })

    test('should find documents using $in operator', async () => {
      const docs = await provider.find(
        { 'metadata.data.priority': { $in: ['high', 'low'] } } as FilterQuery<Document>,
        { collection: 'test-collection' }
      )
      expect(docs).toHaveLength(2)
    })

    test('should find documents using comparison operators', async () => {
      const docs = await provider.find(
        { 'metadata.version': { $gte: 1 } } as FilterQuery<Document>,
        { collection: 'test-collection' }
      )
      expect(docs).toHaveLength(2)
    })

    test('should return empty array for non-matching filter', async () => {
      const docs = await provider.find(
        { 'metadata.data.priority': 'medium' } as FilterQuery<Document>,
        { collection: 'test-collection' }
      )
      expect(docs).toHaveLength(0)
    })

    test('should throw error when collection is not provided', async () => {
      await expect(provider.find({ 'metadata.data.priority': 'high' } as FilterQuery<Document>, {})).rejects.toThrow(
        'Collection name must be provided in options.collection'
      )
    })
  })

  describe('search', () => {
    test('should find documents by text content', async () => {
      const results = await provider.search('document one', { collection: 'test-collection' })
      expect(results).toHaveLength(1)
      expect(results[0].document.content).toBe('Test document one')
      expect(results[0].score).toBeGreaterThan(0)
    })

    test('should find documents by partial match', async () => {
      const results = await provider.search('document', { collection: 'test-collection' })
      expect(results).toHaveLength(2)
    })

    test('should return empty array for non-matching query', async () => {
      const results = await provider.search('nonexistent', { collection: 'test-collection' })
      expect(results).toHaveLength(0)
    })

    test('should respect limit option', async () => {
      const results = await provider.search('document', { collection: 'test-collection', limit: 1 })
      expect(results).toHaveLength(1)
    })

    test('should throw error for empty query', async () => {
      await expect(provider.search('', { collection: 'test-collection' })).rejects.toThrow(
        'Search query must be a non-empty string'
      )
    })
  })

  describe('vectorSearch', () => {
    test('should find documents by vector similarity', async () => {
      const results = await provider.vectorSearch({
        vector: Array(256).fill(0.1),
        collection: 'test-collection'
      })
      expect(results).toHaveLength(2)
      expect(results[0].score).toBeGreaterThan(results[1].score)
    })

    test('should respect threshold option', async () => {
      const results = await provider.vectorSearch({
        vector: Array(256).fill(0.1),
        threshold: 0.1,
        collection: 'test-collection'
      })
      expect(results.every(r => r.score >= 0.9)).toBe(true) // Since score = 1 - distance
    })

    test('should include vectors when requested', async () => {
      const results = await provider.vectorSearch({
        vector: Array(256).fill(0.1),
        includeVectors: true,
        collection: 'test-collection'
      })
      expect(results[0].vector).toBeDefined()
      expect(results[0].vector).toHaveLength(256)
    })

    test('should return empty array for non-matching threshold', async () => {
      const results = await provider.vectorSearch({
        vector: Array(256).fill(0.1),
        threshold: 0.0001,
        collection: 'test-collection'
      })
      expect(results).toHaveLength(0)
    })

    test('should throw error for invalid vector', async () => {
      await expect(
        provider.vectorSearch({
          vector: [],
          collection: 'test-collection'
        })
      ).rejects.toThrow('Vector must be provided as an array of numbers')
    })
  })
})
