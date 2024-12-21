import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import type { Document, FilterQuery, SearchOptions, VectorSearchOptions } from '@mdxdb/types'
import { FetchProvider, FetchError } from '../src'

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('FetchProvider', () => {
  const baseUrl = 'http://localhost:3000'
  const namespace = 'test.example.com'

  it('should create a provider instance', () => {
    const provider = new FetchProvider({ namespace, baseUrl })
    expect(provider.namespace).toBe(namespace)
  })

  it('should list collections', async () => {
    server.use(
      http.get(`${baseUrl}/collections`, () => {
        return HttpResponse.json(['posts', 'users'])
      })
    )

    const provider = new FetchProvider({ namespace, baseUrl })
    const collections = await provider.list()
    expect(collections).toEqual(['posts', 'users'])
  })

  it('should handle network errors with retries', async () => {
    let attempts = 0
    server.use(
      http.get(`${baseUrl}/collections`, () => {
        attempts++
        if (attempts < 3) {
          return HttpResponse.error()
        }
        return HttpResponse.json(['posts'])
      })
    )

    const provider = new FetchProvider({
      namespace,
      baseUrl,
      retries: 3,
      retryDelay: 100
    })

    const collections = await provider.list()
    expect(collections).toEqual(['posts'])
    expect(attempts).toBe(3)
  })

  it('should throw after max retries', async () => {
    server.use(
      http.get(`${baseUrl}/collections`, () => {
        return HttpResponse.error()
      })
    )

    const provider = new FetchProvider({
      namespace,
      baseUrl,
      retries: 2,
      retryDelay: 100
    })

    await expect(provider.list()).rejects.toThrow(FetchError)
  })
})

describe('FetchCollectionProvider', () => {
  const baseUrl = 'http://localhost:3000'
  const namespace = 'test.example.com'

  interface TestDocument extends Document {
    data: {
      $id: string
      $type: string
      title: string
      [key: string]: unknown
    }
  }

  const mockDocument: TestDocument = {
    id: '1',
    content: 'Test content',
    data: {
      $id: '1',
      $type: 'post',
      title: 'Test'
    },
    metadata: {
      id: '1',
      type: 'post'
    },
    embeddings: [],
    collections: [],
    getId: () => '1',
    getType: () => 'post',
    getCollections: () => [],
    belongsToCollection: () => false,
    getEmbeddings: () => []
  }

  it('should find documents', async () => {
    server.use(
      http.post(`${baseUrl}/collections/posts/find`, async ({ request }) => {
        const data = await request.json() as { filter: FilterQuery<TestDocument>; options?: SearchOptions<TestDocument> }
        expect(data.filter).toEqual({ metadata: { type: 'post' }, data: { title: 'Test', $type: 'post' } })
        const responseDoc = { ...mockDocument }
        delete (responseDoc as any).getId
        delete (responseDoc as any).getType
        delete (responseDoc as any).getCollections
        delete (responseDoc as any).belongsToCollection
        delete (responseDoc as any).getEmbeddings
        return HttpResponse.json([{ document: responseDoc, score: 1 }])
      })
    )

    const provider = new FetchProvider<TestDocument>({ namespace, baseUrl })
    const posts = provider.collection('posts')
    const docs = await posts.find({ metadata: { type: 'post' }, data: { title: 'Test', $type: 'post' } })
    const expectedDoc = { ...mockDocument }
    delete (expectedDoc as any).getId
    delete (expectedDoc as any).getType
    delete (expectedDoc as any).getCollections
    delete (expectedDoc as any).belongsToCollection
    delete (expectedDoc as any).getEmbeddings
    expect(docs).toEqual([{ document: expectedDoc, score: 1 }])
    expect(results[0]?.document?.id).toBe('1')
    expect(results[0]?.document?.metadata?.type).toBe('post')
    expect(results[0]?.document?.data?.$id).toBe('1')
    expect(results[0]?.document?.data?.$type).toBe('post')
  })

  it('should search documents', async () => {
    server.use(
      http.post(`${baseUrl}/collections/posts/search`, async ({ request }) => {
        const data = await request.json() as { query: string; options?: SearchOptions<TestDocument> }
        expect(data.query).toBe('test')
        const responseDoc = { ...mockDocument }
        delete (responseDoc as any).getId
        delete (responseDoc as any).getType
        delete (responseDoc as any).getCollections
        delete (responseDoc as any).belongsToCollection
        delete (responseDoc as any).getEmbeddings
        return HttpResponse.json([{ document: responseDoc, score: 1 }])
      })
    )

    const provider = new FetchProvider<TestDocument>({ namespace, baseUrl })
    const posts = provider.collection('posts')
    const results = await posts.search('test') as SearchResult<TestDocument>[]
    const expectedDoc = { ...mockDocument }
    delete (expectedDoc as any).getId
    delete (expectedDoc as any).getType
    delete (expectedDoc as any).getCollections
    delete (expectedDoc as any).belongsToCollection
    delete (expectedDoc as any).getEmbeddings
    expect(results).toEqual([{ document: expectedDoc, score: 1 }])
    expect(results[0]?.document?.id).toBe('1')
    expect(results[0]?.document?.metadata?.type).toBe('post')
    expect(results[0]?.document?.data?.$id).toBe('1')
    expect(results[0]?.document?.data?.$type).toBe('post')
  })

  it('should perform vector search', async () => {
    const vector = new Array(256).fill(0)
    server.use(
      http.post(`${baseUrl}/collections/posts/vector-search`, async ({ request }) => {
        const data = await request.json() as VectorSearchOptions & SearchOptions<TestDocument>
        expect(data.vector).toEqual(vector)
        const responseDoc = { ...mockDocument }
        delete (responseDoc as any).getId
        delete (responseDoc as any).getType
        delete (responseDoc as any).getCollections
        delete (responseDoc as any).belongsToCollection
        delete (responseDoc as any).getEmbeddings
        return HttpResponse.json([{ document: responseDoc, score: 1, vector }])
      })
    )

    const provider = new FetchProvider<TestDocument>({ namespace, baseUrl })
    const posts = provider.collection('posts')
    const results = await posts.vectorSearch({ vector, threshold: 0.8 }) as SearchResult<TestDocument>[]
    const expectedDoc = { ...mockDocument }
    delete (expectedDoc as any).getId
    delete (expectedDoc as any).getType
    delete (expectedDoc as any).getCollections
    delete (expectedDoc as any).belongsToCollection
    delete (expectedDoc as any).getEmbeddings
    expect(results).toEqual([{ document: expectedDoc, score: 1, vector }])
    expect(results[0]?.document?.id).toBe('1')
    expect(results[0]?.document?.metadata?.type).toBe('post')
    expect(results[0]?.document?.data?.$id).toBe('1')
    expect(results[0]?.document?.data?.$type).toBe('post')
  })

  it('should handle HTTP errors', async () => {
    server.use(
      http.post(`${baseUrl}/collections/posts/find`, () => {
        return new HttpResponse(null, { status: 500 })
      })
    )

    const provider = new FetchProvider<TestDocument>({ namespace, baseUrl })
    const posts = provider.collection('posts')
    await expect(posts.find({})).rejects.toThrow(FetchError)
  })
})
