import type { DatabaseProvider, Document, CollectionProvider, VectorSearchOptions, FilterQuery, SearchOptions } from '@mdxdb/types'

export interface FetchProviderOptions {
  namespace: string
  baseUrl: string
  headers?: Record<string, string>
  timeout?: number
  retries?: number
  retryDelay?: number
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string
  ) {
    super(message)
    this.name = 'FetchError'
  }
}

class FetchCollectionProvider<T extends Document = Document> implements CollectionProvider<T> {
  constructor(
    public readonly path: string,
    private readonly baseUrl: string,
    private readonly headers: Record<string, string>,
    private readonly fetchWithRetry: (path: string, init?: RequestInit) => Promise<Response>
  ) {}

  async find(filter: FilterQuery<T>, options?: SearchOptions<T>): Promise<T[]> {
    const response = await this.fetchWithRetry(`collections/${this.path}/find`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ filter, ...options })
    })
    return response.json()
  }

  async search(query: string, options?: SearchOptions<T>): Promise<T[]> {
    const response = await this.fetchWithRetry(`collections/${this.path}/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, ...options })
    })
    return response.json()
  }

  async vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<T[]> {
    const response = await this.fetchWithRetry(`collections/${this.path}/vector-search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(options)
    })
    return response.json()
  }
}

const providerState = new WeakMap<FetchProvider<any>, {
  options: Required<Omit<FetchProviderOptions, 'namespace'>>
  fetchWithRetry: (path: string, init?: RequestInit, retryCount?: number) => Promise<Response>
}>()

export class FetchProvider<T extends Document = Document> implements DatabaseProvider<T> {
  readonly namespace: string

  constructor(options: FetchProviderOptions) {
    this.namespace = options.namespace
    const { namespace, ...rest } = options
    const state = {
      options: {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        retries: 3,
        retryDelay: 1000,
        ...rest,
        baseUrl: rest.baseUrl.endsWith('/') ? rest.baseUrl.slice(0, -1) : rest.baseUrl
      },
      fetchWithRetry: async (path: string, init?: RequestInit, retryCount = 0): Promise<Response> => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), state.options.timeout)

        try {
          const response = await fetch(`${state.options.baseUrl}/${path}`, {
            ...init,
            headers: { ...state.options.headers, ...(init?.headers || {}) },
            signal: controller.signal
          })

          if (!response.ok) {
            throw new FetchError(
              `HTTP error ${response.status}`,
              response.status,
              response.statusText
            )
          }

          return response
        } catch (error) {
          if (retryCount < state.options.retries) {
            await new Promise(resolve => setTimeout(resolve, state.options.retryDelay))
            return state.fetchWithRetry(path, init, retryCount + 1)
          }
          if (error instanceof Error) {
            throw new FetchError(error.message)
          }
          throw error
        } finally {
          clearTimeout(timeout)
        }
      }
    }
    providerState.set(this, state)
  }

  async connect(): Promise<void> {
    // No-op for HTTP provider
  }

  async disconnect(): Promise<void> {
    // No-op for HTTP provider
  }

  async list(): Promise<string[]> {
    const state = providerState.get(this)!
    const response = await state.fetchWithRetry('collections')
    return response.json()
  }

  collection(name: string): CollectionProvider<T> {
    const state = providerState.get(this)!
    return new FetchCollectionProvider<T>(
      name,
      state.options.baseUrl,
      state.options.headers,
      state.fetchWithRetry
    )
  }

  [key: string]: DatabaseProvider<T> | CollectionProvider<T> | string | (() => Promise<void>) | (() => Promise<string[]>) | ((name: string) => CollectionProvider<T>)
}
