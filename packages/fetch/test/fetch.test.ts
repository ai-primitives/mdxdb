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
      type: 'post'
    },
    embeddings: [],
    collections: []
  }

  it('should find documents', async () => {
    server.use(
      http.post(`${baseUrl}/collections/posts/find`, async ({ request }) => {
        const data = await request.json() as { filter: FilterQuery<TestDocument>; options?: SearchOptions<TestDocument> }
        expect(data.filter).toEqual({ metadata: { type: 'post' }, title: 'Test' })
        return HttpResponse.json([mockDocument])
      })
    )

    const provider = new FetchProvider<TestDocument>({ namespace, baseUrl })
    const posts = provider.collection('posts')
    const docs = await posts.find({ metadata: { type: 'post' }, 'data.title': 'Test' })
    expect(docs).toEqual([mockDocument])
    expect(docs[0]?.id).toBe('1')
    expect(docs[0]?.metadata?.type).toBe('post')
    expect(docs[0]?.data?.$id).toBe('1')
    expect(docs[0]?.data?.$type).toBe('post')
  })

  it('should search documents', async () => {
    server.use(
      http.post(`${baseUrl}/collections/posts/search`, async ({ request }) => {
        const data = await request.json() as { query: string; options?: SearchOptions<TestDocument> }
        expect(data.query).toBe('test')
        return HttpResponse.json([mockDocument])
      })
    )

    const provider = new FetchProvider<TestDocument>({ namespace, baseUrl })
    const posts = provider.collection('posts')
    const docs = await posts.search('test')
    expect(docs).toEqual([{ document: mockDocument, score: 1 }])
    expect(docs[0]?.document?.id).toBe('1')
    expect(docs[0]?.document?.metadata?.type).toBe('post')
    expect(docs[0]?.document?.data?.$id).toBe('1')
    expect(docs[0]?.document?.data?.$type).toBe('post')
  })

  it('should perform vector search', async () => {
    const vector = new Array(256).fill(0)
    server.use(
      http.post(`${baseUrl}/collections/posts/vector-search`, async ({ request }) => {
        const data = await request.json() as VectorSearchOptions & SearchOptions<TestDocument>
        expect(data.vector).toEqual(vector)
        return HttpResponse.json([mockDocument])
      })
    )

    const provider = new FetchProvider<TestDocument>({ namespace, baseUrl })
    const posts = provider.collection('posts')
    const docs = await posts.vectorSearch({ vector, threshold: 0.8 })
    expect(docs).toEqual([{ document: mockDocument, score: 1, vector }])
    expect(docs[0]?.document?.id).toBe('1')
    expect(docs[0]?.document?.metadata?.type).toBe('post')
    expect(docs[0]?.document?.data?.$id).toBe('1')
    expect(docs[0]?.document?.data?.$type).toBe('post')
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
