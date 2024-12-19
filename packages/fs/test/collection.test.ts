import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FSCollection } from '../src/collection'
import { CollectionProvider, Document } from '@mdxdb/types'
import { promises as fs } from 'fs'
import * as nodePath from 'path'
import { EmbeddingsService } from '../src/embeddings'
import { EmbeddingsStorageService } from '../src/storage'

vi.mock('../src/embeddings')
vi.mock('../src/storage')

const TEST_DIR = nodePath.join(__dirname, '.test-collection')

beforeEach(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true })
  vi.clearAllMocks()
})

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true })
})

describe('FSCollection', () => {
  it('implements CollectionProvider interface', () => {
    const collection = new FSCollection(TEST_DIR, 'test')
    expect(collection).toBeDefined()
    expect(collection.path).toBe('test')
    expect(typeof collection.find).toBe('function')
    expect(typeof collection.search).toBe('function')
    expect(typeof collection.vectorSearch).toBe('function')
  })

  describe('CRUD operations', () => {
    it('should create and read documents', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      const doc: Document = { id: 'test1', content: 'test content', data: {} }

      await collection.insert('test1', doc)
      const docs = await collection.get('test1')

      expect(docs).toHaveLength(1)
      expect(docs[0]).toMatchObject(doc)
      expect(EmbeddingsService.prototype.generateEmbedding).toHaveBeenCalledWith('test content')
      expect(EmbeddingsStorageService.prototype.storeEmbedding).toHaveBeenCalled()
    })

    it('should update documents', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      const doc: Document = { id: 'test1', content: 'test content', data: {} }
      const updatedDoc: Document = { id: 'test1', content: 'updated content', data: {} }

      await collection.insert('test1', doc)
      await collection.update('test1', { id: 'test1' }, updatedDoc)
      const docs = await collection.get('test1')

      expect(docs).toHaveLength(1)
      expect(docs[0]).toMatchObject(updatedDoc)
      expect(EmbeddingsService.prototype.generateEmbedding).toHaveBeenCalledWith('updated content')
      expect(EmbeddingsStorageService.prototype.storeEmbedding).toHaveBeenCalled()
    })

    it('should delete documents', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      const doc: Document = { id: 'test1', content: 'test content', data: {} }

      await collection.insert('test1', doc)
      await collection.delete('test1', { id: 'test1' })
      const docs = await collection.get('test1')

      expect(docs).toHaveLength(0)
      expect(EmbeddingsStorageService.prototype.deleteEmbedding).toHaveBeenCalledWith('test1/test1')
    })

    it('should throw error when creating existing document', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      const doc: Document = { id: 'test1', content: 'test content', data: {} }

      await collection.insert('test1', doc)
      await expect(collection.insert('test1', doc)).rejects.toThrow('already exists')
    })

    it('should throw error when updating non-existent document', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      const doc: Document = { id: 'test1', content: 'test content', data: {} }

      await expect(collection.update('test1', { id: 'test1' }, doc)).rejects.toThrow('not found')
    })
  })

  describe('Vector Search Operations', () => {
    const mockEmbeddings = {
      doc1: Array(256).fill(0.1),
      doc2: Array(256).fill(0.2),
      doc3: Array(256).fill(0.3)
    }
    const mockDocs = [
      { id: 'doc1', content: 'test content 1', data: {} },
      { id: 'doc2', content: 'test content 2', data: {} },
      { id: 'doc3', content: 'different content', data: {} }
    ]

    beforeEach(async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      for (const doc of mockDocs) {
        const filePath = nodePath.join(TEST_DIR, 'test', `${doc.id}.mdx`)
        await fs.mkdir(nodePath.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, doc.content)
      }

      vi.mocked(EmbeddingsStorageService.prototype.getEmbedding).mockImplementation(async (id) => {
        const doc = mockDocs.find(d => d.id === id)
        if (!doc) return null
        return {
          id,
          content: doc.content,
          embedding: mockEmbeddings[id],
          timestamp: Date.now()
        }
      })

      vi.mocked(EmbeddingsService.prototype.calculateSimilarity).mockImplementation((vec1, vec2) => {
        const isDoc1 = vec2.every((val, idx) => val === mockEmbeddings.doc1[idx])
        return isDoc1 ? 0.9 : 0.5
      })
    })

    it('should filter results by similarity threshold', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      const results = await collection.vectorSearch({
        vector: mockEmbeddings.doc1,
        threshold: 0.8
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        document: {
          id: 'doc1',
          content: 'test content 1',
          data: {}
        },
        score: 0.9
      })
    })

    it('should limit number of results', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      const results = await collection.vectorSearch({
        vector: mockEmbeddings.doc1,
        threshold: 0.4,
        limit: 2
      })

      expect(results).toHaveLength(2)
      expect(results[0]).toMatchObject({
        document: {
          id: 'doc1',
          content: 'test content 1',
          data: {}
        },
        score: 0.9
      })
      expect(results[1]).toMatchObject({
        document: {
          id: expect.any(String),
          content: expect.any(String),
          data: {}
        },
        score: 0.5
      })
    })

    it('should sort results by similarity score', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      vi.mocked(EmbeddingsService.prototype.calculateSimilarity).mockImplementation((vec1, vec2) => {
        return mockDocs[0].id === 'doc1' ? 0.9 : 0.5
      })

      const results = await collection.vectorSearch({
        vector: mockEmbeddings.doc1,
        threshold: 0.4
      })

      expect(results[0]).toMatchObject({
        document: {
          id: 'doc1',
          content: 'test content 1',
          data: {}
        },
        score: 0.9
      })
    })
  })

  describe('Text Search Operations', () => {
    it('should convert text query to embedding for search', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      const mockEmbedding = Array(256).fill(0.1)

      vi.mocked(EmbeddingsService.prototype.generateEmbedding).mockResolvedValue(mockEmbedding)

      await collection.search('test query')

      expect(EmbeddingsService.prototype.generateEmbedding).toHaveBeenCalledWith('test query')
    })

    it('should use default threshold for text search', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      const mockEmbedding = Array(256).fill(0.1)

      vi.mocked(EmbeddingsService.prototype.generateEmbedding).mockResolvedValue(mockEmbedding)
      const vectorSearchSpy = vi.spyOn(collection, 'vectorSearch')

      await collection.search('test query')

      expect(vectorSearchSpy).toHaveBeenCalledWith({
        vector: mockEmbedding,
        threshold: 0.7
      })
    })

    it('should respect custom threshold for text search', async () => {
      const collection = new FSCollection(TEST_DIR, 'test')
      const mockEmbedding = Array(256).fill(0.1)

      vi.mocked(EmbeddingsService.prototype.generateEmbedding).mockResolvedValue(mockEmbedding)
      const vectorSearchSpy = vi.spyOn(collection, 'vectorSearch')

      await collection.search('test query', { threshold: 0.9 })

      expect(vectorSearchSpy).toHaveBeenCalledWith({
        vector: mockEmbedding,
        threshold: 0.9
      })
    })
  })
})
