import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { ClickHouseCollectionProvider } from '../../src/client'
import { dockerTestConfig } from '../docker.config'
import type { Document } from '@mdxdb/types'

describe('ClickHouseCollectionProvider', () => {
  let provider: ClickHouseCollectionProvider

  beforeAll(async () => {
    provider = new ClickHouseCollectionProvider({
      protocol: dockerTestConfig.protocol,
      host: dockerTestConfig.host,
      port: dockerTestConfig.port,
      database: dockerTestConfig.database,
      username: dockerTestConfig.username,
      password: dockerTestConfig.password,
      dataTable: dockerTestConfig.dataTable,
      oplogTable: dockerTestConfig.oplogTable
    })

    // Add test documents
    const testDocs: Document[] = [
      {
        content: 'Test document one',
        data: { category: 'test', priority: 'high' },
        embeddings: Array(256).fill(0.1),
        collections: ['test-collection'],
        metadata: {
          id: 'test1',
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
          id: 'test2',
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
      await provider.add(doc, { collection: 'test-collection' })
    }
  })

  afterAll(async () => {
    // Clean up test documents
    await provider.client.exec({
      query: `TRUNCATE TABLE IF EXISTS ${dockerTestConfig.database}.${dockerTestConfig.dataTable}`
    })
  })

  describe('find', () => {
    test('should find documents by exact match', async () => {
      const docs = await provider.find(
        { 'data.priority': 'high' },
        { collection: 'test-collection' }
      )
      expect(docs).toHaveLength(1)
      expect(docs[0].data.priority).toBe('high')
    })

    test('should find documents using $in operator', async () => {
      const docs = await provider.find(
        { 'data.priority': { $in: ['high', 'low'] } },
        { collection: 'test-collection' }
      )
      expect(docs).toHaveLength(2)
    })

    test('should find documents using comparison operators', async () => {
      const docs = await provider.find(
        { 'metadata.version': { $gte: 1 } },
        { collection: 'test-collection' }
      )
      expect(docs).toHaveLength(2)
    })

    test('should return empty array for non-matching filter', async () => {
      const docs = await provider.find(
        { 'data.priority': 'medium' },
        { collection: 'test-collection' }
      )
      expect(docs).toHaveLength(0)
    })

    test('should throw error when collection is not provided', async () => {
      await expect(provider.find({ 'data.priority': 'high' }, {})).rejects.toThrow(
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
