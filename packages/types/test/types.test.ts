import { expect, test } from 'vitest'
import { Database, Collection, Document, EmbeddingOptions, createEmbedding } from '../src'

test('Document interface extends MDXLD', () => {
  const doc: Document = {
    id: 'test',
    type: 'Article',
    content: '# Test',
    data: {},
    embeddings: [0.1, 0.2],
    collections: ['blog']
  }
  expect(doc).toBeDefined()
  expect(doc.id).toBe('test')
  expect(doc.type).toBe('Article')
  expect(doc.content).toBe('# Test')
  expect(doc.embeddings).toHaveLength(2)
  expect(doc.collections).toContain('blog')
})

test('Database URI handling', () => {
  const db = new Database({ namespace: 'example.com' })
  const collection = db.collection('blog')
  expect(collection).toBeInstanceOf(Collection)
})

test('Collection search methods exist', () => {
  const db = new Database({ namespace: 'example.com' })
  const collection = db.collection('blog')

  expect(collection.find).toBeInstanceOf(Function)
  expect(collection.search).toBeInstanceOf(Function)
  expect(collection.vectorSearch).toBeInstanceOf(Function)
})

test('EmbeddingOptions with defaults', () => {
  const options: EmbeddingOptions = {
    dimensions: 256
  }
  expect(options.dimensions).toBe(256)
})

test('createEmbedding function exists', () => {
  expect(createEmbedding).toBeInstanceOf(Function)
})
