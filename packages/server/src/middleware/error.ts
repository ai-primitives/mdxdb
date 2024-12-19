import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../core'

export const errorMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    await next()
  } catch (error) {
    console.error('Server error:', error)
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, 500)
  }
}
