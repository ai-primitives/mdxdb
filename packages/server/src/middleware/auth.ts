import type { Context, Next } from 'hono'
import { jwt } from 'hono/jwt'
import type { AppEnv } from '../core'

export const authMiddleware = (c: Context<AppEnv>, next: Next) => {
  const jwtMiddleware = jwt({
    secret: c.env.JWT_SECRET,
    alg: 'HS256'
  })
  return jwtMiddleware(c, next)
}
