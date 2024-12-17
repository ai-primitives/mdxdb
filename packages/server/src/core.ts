import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import type { DatabaseProvider, Document } from '@mdxdb/types'
import type { FSDatabase } from '@mdxdb/fs'
import type { MDXDBClickHouseClient } from '@mdxdb/clickhouse'

export interface ServerConfig {
  provider: 'fs' | 'clickhouse'
  clickhouse?: MDXDBClickHouseClient
  fs?: FSDatabase
}

export interface ServerContext {
  provider: DatabaseProvider<Document>
}

export type AppContext = Context<{
  Bindings: { MDXDB_KV: KVNamespace },
  Variables: ServerContext
}>

export const createApp = (config: ServerConfig) => {
  const app = new Hono<{
    Bindings: { MDXDB_KV: KVNamespace },
    Variables: ServerContext
  }>()

  // Middleware to initialize provider
  const providerMiddleware: MiddlewareHandler<{
    Bindings: { MDXDB_KV: KVNamespace },
    Variables: ServerContext
  }> = async (c, next) => {
    const provider = config.provider === 'fs'
      ? config.fs as DatabaseProvider<Document>
      : config.clickhouse as DatabaseProvider<Document>

    if (!provider) {
      return c.json({ error: 'Provider not configured' }, 500)
    }

    c.set('provider', provider)
    await next()
  }

  app.use('*', providerMiddleware)

  // Collection operations
  app.post('/collections/:name', async (c: AppContext) => {
    const { name } = c.req.param()
    const provider = c.get('provider')

    try {
      const collection = provider.collection(name)
      return c.json({ name, status: 'created' })
    } catch (error) {
      return c.json({ error: 'Failed to create collection' }, 500)
    }
  })

  app.get('/collections', async (c: AppContext) => {
    const provider = c.get('provider')

    try {
      const collections = await provider.list()
      return c.json({ collections })
    } catch (error) {
      return c.json({ error: 'Failed to list collections' }, 500)
    }
  })

  // Document operations
  app.post('/collections/:name/documents', async (c: AppContext) => {
    const { name } = c.req.param()
    const provider = c.get('provider')
    const body = await c.req.json()

    try {
      const collection = provider.collection(name)
      const doc = await collection.create(body)
      return c.json(doc)
    } catch (error) {
      return c.json({ error: 'Failed to create document' }, 500)
    }
  })

  app.get('/collections/:name/documents/:id', async (c: AppContext) => {
    const { name, id } = c.req.param()
    const provider = c.get('provider')

    try {
      const collection = provider.collection(name)
      const doc = await collection.get(id)
      if (!doc) {
        return c.json({ error: 'Document not found' }, 404)
      }
      return c.json(doc)
    } catch (error) {
      return c.json({ error: 'Failed to get document' }, 500)
    }
  })

  // MDX compilation endpoint (placeholder)
  app.post('/compile', async (c: AppContext) => {
    // TODO: Implement MDX compilation using esbuild
    return c.json({ compiled: '' })
  })

  return app
}
