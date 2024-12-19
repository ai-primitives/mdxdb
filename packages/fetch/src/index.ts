import type { DatabaseProvider, Document, CollectionProvider, VectorSearchOptions, FilterQuery, SearchOptions, SearchResult } from '@mdxdb/types'

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
    private readonly _status?: number,
    private readonly _statusText?: string
  ) {
    super(message)
    this.name = 'FetchError'
  }

  get status(): number | undefined {
    return this._status
  }

  get statusText(): string | undefined {
    return this._statusText
  }
}

class FetchCollectionProvider<T extends Document = Document> implements CollectionProvider<T> {
  constructor(
    public readonly path: string,
    private readonly _headers: Record<string, string>,
    private readonly _fetchWithRetry: (_path: string, _init?: RequestInit) => Promise<Response>
  ) {}

  async find(collection: string, filter: FilterQuery<T>, options?: SearchOptions<T>): Promise<T[]> {
    const response = await this._fetchWithRetry(`collections/${collection}/find`, {
      method: 'POST',
      headers: this._headers,
      body: JSON.stringify({ filter, ...options })
    })
    return response.json()
  }

  async findOne?(collection: string, filter: FilterQuery<T>): Promise<T | null> {
    const docs = await this.find(collection, filter, { limit: 1 })
    return docs[0] || null
  }

  async insert(collection: string, document: T): Promise<void> {
    await this._fetchWithRetry(`collections/${collection}`, {
      method: 'POST',
      headers: this._headers,
      body: JSON.stringify(document)
    })
  }

  async update(collection: string, id: string, document: Partial<T>): Promise<void> {
    await this._fetchWithRetry(`collections/${collection}/${id}`, {
      method: 'PUT',
      headers: this._headers,
      body: JSON.stringify(document)
    })
  }

  async delete(collection: string, id: string): Promise<void> {
    await this._fetchWithRetry(`collections/${collection}/${id}`, {
      method: 'DELETE',
      headers: this._headers
    })
  }

  async vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<SearchResult<T>> {
    const response = await this._fetchWithRetry(`collections/${this.path}/vector-search`, {
      method: 'POST',
      headers: this._headers,
      body: JSON.stringify(options)
    })
    const results = await response.json()
    return {
      hits: results.map((doc: T) => ({ document: doc, score: 1 })),
      total: results.length
    }
  }
}

const providerState = new WeakMap<FetchProvider<any>, {
  options: Required<Omit<FetchProviderOptions, 'namespace'>>
  fetchWithRetry: (_path: string, _init?: RequestInit, _retryCount?: number) => Promise<Response>
}>()

export class FetchProvider<T extends Document = Document> implements DatabaseProvider<T> {
  readonly namespace: string
  private readonly collections: CollectionProvider<T>

  constructor(options: FetchProviderOptions) {
    this.namespace = options.namespace
    const { namespace: _namespace, ...rest } = options
    const state = {
      options: {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        retries: 3,
        retryDelay: 1000,
        ...rest,
        baseUrl: rest.baseUrl.endsWith('/') ? rest.baseUrl.slice(0, -1) : rest.baseUrl
      },
      fetchWithRetry: async (_path: string, _init?: RequestInit, _retryCount = 0): Promise<Response> => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), state.options.timeout)

        try {
          const response = await fetch(`${state.options.baseUrl}/${_path}`, {
            ..._init,
            headers: { ...state.options.headers, ...(_init?.headers || {}) },
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
          if (_retryCount < state.options.retries) {
            await new Promise(resolve => setTimeout(resolve, state.options.retryDelay))
            return state.fetchWithRetry(_path, _init, _retryCount + 1)
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
    this.collections = new FetchCollectionProvider<T>(
      '',
      state.options.headers,
      state.fetchWithRetry
    )
  }

  async connect(): Promise<void> {
    // No-op for HTTP provider
  }

  async disconnect(): Promise<void> {
    // No-op for HTTP provider
  }

  async query<R>(query: string): Promise<R> {
    const state = providerState.get(this)!
    const response = await state.fetchWithRetry('query', {
      method: 'POST',
      body: JSON.stringify({ query })
    })
    return response.json()
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
      state.options.headers,
      state.fetchWithRetry
    )
  }
}
