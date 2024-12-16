import { expect, test } from 'vitest'
import type {
  Document,
  DatabaseProvider,
  CollectionProvider,
  VectorSearchOptions,
  FilterQuery,
  SearchOptions
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

test('DatabaseProvider supports namespace operations', () => {
  const db: DatabaseProvider = {
    namespace: 'https://example.com',
    connect: async () => {},
    disconnect: async () => {},
    list: async () => ['api.example.com', 'example.com/docs'],
    collection: () => ({} as CollectionProvider),
    docs: {} as DatabaseProvider
  }
  expect(db).toBeDefined()
  expect(db.namespace).toBe('https://example.com')
  expect(typeof db.connect).toBe('function')
  expect(typeof db.list).toBe('function')
  expect(typeof db.collection).toBe('function')
})

test('CollectionProvider supports search operations', () => {
  const collection: CollectionProvider = {
    path: 'posts',
    find: async (filter: FilterQuery<Document>) => [],
    search: async (query: string, options?: SearchOptions<Document>) => [],
    vectorSearch: async (options: VectorSearchOptions & SearchOptions<Document>) => []
  }
  expect(collection).toBeDefined()
  expect(collection.path).toBe('posts')
  expect(typeof collection.find).toBe('function')
  expect(typeof collection.search).toBe('function')
  expect(typeof collection.vectorSearch).toBe('function')
})

test('FilterQuery supports MongoDB-style operators', () => {
  const filter: FilterQuery<Document> = {
    title: 'Example',
    rank: { $gt: 5 },
    tags: { $in: ['typescript', 'javascript'] }
  }
  expect(filter).toBeDefined()
  expect(filter.title).toBe('Example')
  expect(filter.rank.$gt).toBe(5)
  expect(Array.isArray(filter.tags.$in)).toBe(true)
})

test('SearchOptions supports pagination and thresholds', () => {
  const options: SearchOptions<Document> = {
    filter: { category: 'blog' },
    threshold: 0.8,
    limit: 10,
    offset: 0,
    includeVectors: true
  }
  expect(options).toBeDefined()
  expect(options.threshold).toBe(0.8)
  expect(options.limit).toBe(10)
  expect(options.offset).toBe(0)
  expect(options.includeVectors).toBe(true)
})
