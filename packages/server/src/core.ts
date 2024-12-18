import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Context, Env, MiddlewareHandler } from 'hono'
import type { JwtVariables } from 'hono/jwt'
import type { DatabaseProvider, Document } from '@mdxdb/types'
import { compileToESM } from './compiler'
import { deployToCloudflare, type DeploymentOptions } from './deployment'
import { authMiddleware } from './middleware/auth'
import { errorMiddleware } from './middleware/error'

// Request validation schemas
const searchSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
  collection: z.string()
})

const vectorSearchSchema = z.object({
  vector: z.array(z.number()),
  limit: z.number().optional(),
  threshold: z.number().optional(),
  collection: z.string()
})

const documentSchema = z.object({
  id: z.string().optional(),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  data: z.record(z.any()).optional(),
  type: z.string().optional(),
  collections: z.array(z.string()).optional()
})

const compileSchema = z.object({
  content: z.string(),
  options: z.object({
    format: z.enum(['esm', 'cjs']).optional(),
    minify: z.boolean().optional()
  }).optional()
})

const deploySchema = z.object({
  script: z.string(),
  name: z.string(),
  accountId: z.string(),
  namespace: z.string(),
  token: z.string().optional()
})

export interface ServerConfig {
  provider: 'fs' | 'clickhouse'
  clickhouse?: DatabaseProvider<Document>
  fs?: DatabaseProvider<Document>
}

export interface ServerContext {
  Variables: {
    provider: DatabaseProvider<Document>
  }
}

export interface ServerBindings {
  JWT_SECRET: string
  CLICKHOUSE_URL?: string
  CLICKHOUSE_USERNAME?: string
  CLICKHOUSE_PASSWORD?: string
}

export type AppEnv = {
  Bindings: ServerBindings
  Variables: JwtVariables & ServerContext['Variables']
} & Env

export const createApp = (config: ServerConfig) => {
  const app = new Hono<AppEnv>()

  // Middleware to initialize provider
  const providerMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
    const provider = config.provider === 'fs'
      ? config.fs
      : config.clickhouse

    if (!provider) {
      return c.json({ error: 'Provider not configured' }, 500)
    }

    c.set('provider', provider as DatabaseProvider<Document>)
    await next()
  }

  app.use('*', errorMiddleware)
  app.use('*', providerMiddleware)
  app.use('*', authMiddleware)
  app.use('*', cors())

  // Collection operations
  app.post('/collections/:name', async (c: Context<AppEnv>) => {
    const { name } = c.req.param()
    const provider = c.get('provider')

    try {
      await provider.collections.create(name)
      return c.json({ name, status: 'created' })
    } catch (error) {
      console.error('Failed to create collection:', error)
      return c.json({ error: 'Failed to create collection' }, 500)
    }
  })

  app.get('/collections', async (c: Context<AppEnv>) => {
    const provider = c.get('provider')

    try {
      const collections = await provider.list()
      return c.json({ collections })
    } catch (error) {
      console.error('Failed to list collections:', error)
      return c.json({ error: 'Failed to list collections' }, 500)
    }
  })

  // Document operations
  app.post('/collections/:name/documents', zValidator('json', documentSchema), async (c: Context<AppEnv>) => {
    const { name } = c.req.param()
    const provider = c.get('provider')
    const body = await c.req.json()

    try {
      await provider.collections.add(name, body)
      return c.json({ status: 'created' })
    } catch (error) {
      console.error('Failed to create document:', error)
      return c.json({ error: 'Failed to create document' }, 500)
    }
  })

  app.get('/collections/:name/documents/:id', async (c: Context<AppEnv>) => {
    const { name, id } = c.req.param()
    const provider = c.get('provider')

    try {
      const docs = await provider.collections.get(name)
      const doc = docs.find(d => d.id === id)
      if (!doc) {
        return c.json({ error: 'Document not found' }, 404)
      }
      return c.json(doc)
    } catch (error) {
      console.error('Failed to get document:', error)
      return c.json({ error: 'Failed to get document' }, 500)
    }
  })

  // Document search operations
  app.post('/collections/:name/search', zValidator('json', searchSchema), async (c: Context<AppEnv>) => {
    const { name } = c.req.param()
    const provider = c.get('provider')
    const { query, limit } = await c.req.json()

    try {
      const results = await provider.collections.search(query, {
        collection: name,
        limit: limit || 10
      })
      return c.json({ results })
    } catch (error) {
      console.error('Failed to search documents:', error)
      return c.json({ error: 'Failed to search documents' }, 500)
    }
  })

  app.post('/collections/:name/vector-search', zValidator('json', vectorSearchSchema), async (c: Context<AppEnv>) => {
    const { name } = c.req.param()
    const provider = c.get('provider')
    const { vector, limit, threshold = 0.7 } = await c.req.json()

    try {
      const results = await provider.collections.vectorSearch({
        vector,
        collection: name,
        limit: limit || 10,
        threshold
      })
      return c.json({ results })
    } catch (error) {
      console.error('Failed to perform vector search:', error)
      throw error
    }
  })

  // MDX compilation endpoint
  app.post('/compile', zValidator('json', compileSchema), async (c: Context<AppEnv>) => {
    const { content, options = {} } = await c.req.json()

    try {
      const compiled = await compileToESM(content, options)
      return c.json({ success: true, result: compiled })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return c.json({
        success: false,
        error: message,
        details: error instanceof Error ? error.stack : undefined
      }, 500)
    }
  })

  // Deployment endpoint
  app.post('/deploy', zValidator('json', deploySchema), async (c: Context<AppEnv>) => {
    const { script, name, accountId, namespace, token } = await c.req.json()

    try {
      const options: DeploymentOptions = {
        accountId,
        namespace,
        name,
        token: token || process.env.CLOUDFLARE_API_TOKEN || ''
      }

      if (!options.token) {
        return c.json({
          success: false,
          errors: ['Missing Cloudflare API token']
        }, 401)
      }

      const result = await deployToCloudflare(script, options)
      return c.json(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return c.json({
        success: false,
        errors: [message],
        details: error instanceof Error ? error.stack : undefined
      }, 500)
    }
  })

  return app
}
