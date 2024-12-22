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
    metadata: {
      id: 'test'
    },
    content: 'test content',
    data: {},
    embeddings: [0.1, 0.2],
    collections: ['test']
  }
  expect(doc).toBeDefined()
  expect(doc.metadata.id).toBe('test')
})

test('DatabaseProvider supports namespace operations', () => {
  const db: DatabaseProvider = {
    namespace: 'https://example.com',
    collections: {} as CollectionProvider,
    connect: async () => {},
    disconnect: async () => {},
    list: async () => ['api.example.com', 'example.com/docs'],
    collection: () => ({} as CollectionProvider)
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
    create: async (collection: string) => {},
    get: async (collection: string) => [],
    add: async (collection: string, document: Document) => {},
    update: async (collection: string, id: string, document: Document) => {},
    delete: async (collection: string, id: string) => {},
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
    metadata: {
      id: 'example-doc',
      type: 'post',
      data: {
        rank: { $gt: 5 },
        tags: { $in: ['typescript', 'javascript'] }
      }
    }
  }
  expect(filter).toBeDefined()
  expect(filter.metadata?.id).toBe('example-doc')
  expect(filter.metadata?.type).toBe('post')
  // Data is a Record<string, unknown>, so we can't type-check its contents
  expect((filter.metadata?.data as any)?.rank?.$gt).toBe(5)
  expect(Array.isArray((filter.metadata?.data as any)?.tags?.$in)).toBe(true)
})

test('SearchOptions supports pagination and thresholds', () => {
  const options: SearchOptions<Document> = {
    filter: { metadata: { type: 'blog' } },
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
