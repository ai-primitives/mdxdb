import { expect, test } from 'vitest'
import type { Document, DatabaseProvider, CollectionProvider, EmbeddingOptions, EmbeddingModel } from '../src'

test('Document type has required fields', () => {
  const doc: Document = {
    id: 'test',
    type: 'Article',
    content: '# Test',
    data: {},
    embedding: {
      vector: [0.1, 0.2],
      text: '# Test'
    },
    collections: ['blog']
  }
  expect(doc).toBeDefined()
})

test('Provider types are properly defined', () => {
  const provider: DatabaseProvider = {
    namespace: 'example.com',
    collection: (path: string): CollectionProvider => ({
      path,
      find: async () => [],
      search: async () => [],
      vectorSearch: async () => []
    })
  }
  expect(provider).toBeDefined()
})

test('EmbeddingModel type is properly defined', () => {
  const model: EmbeddingModel = {
    dimensions: 256,
    embed: async () => [0.1, 0.2]
  }
  expect(model).toBeDefined()
})

test('EmbeddingOptions type is properly defined', () => {
  const options: EmbeddingOptions = {
    model: {
      dimensions: 256,
      embed: async () => [0.1, 0.2]
    }
  }
  expect(options).toBeDefined()
})
