import { expect, test } from 'vitest'
import type {
  Document,
  DatabaseProvider,
  CollectionProvider,
  VectorSearchOptions,
  EmbeddingOptions,
  EmbeddingProvider
} from '../src'

test('Document type has required fields', () => {
  const doc: Document = {
    id: 'test',
    content: 'test content',
    data: {},
    embeddings: [0.1, 0.2],
    collections: ['test']
  }
  expect(doc).toBeDefined()
})

test('Provider types are properly defined', () => {
  const provider: DatabaseProvider = {
    name: 'test',
    connect: async () => {},
    disconnect: async () => {},
    collections: async () => []
  }
  expect(provider).toBeDefined()
})

test('VectorSearchOptions type is properly defined', () => {
  const options: VectorSearchOptions = {
    vector: [0.1, 0.2],
    query: 'test query',
    filter: { category: 'test' },
    k: 10,
    threshold: 0.8
  }
  expect(options).toBeDefined()
})

test('EmbeddingProvider type is properly defined', () => {
  const provider: EmbeddingProvider = {
    embed: async (text: string, options?: EmbeddingOptions) => [0.1, 0.2]
  }
  expect(provider).toBeDefined()
})

test('EmbeddingOptions type is properly defined', () => {
  const options: EmbeddingOptions = {
    dimensions: 256,
    model: 'text-embedding-3-large'
  }
  expect(options).toBeDefined()
})
