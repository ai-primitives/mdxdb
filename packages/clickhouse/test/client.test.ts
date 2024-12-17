import { describe, it, expect } from 'vitest'
import { createClient } from '../src'

describe('ClickHouse Client', () => {
  it('should create client with default config', () => {
    const client = createClient()
    expect(client).toBeDefined()
  })
})
