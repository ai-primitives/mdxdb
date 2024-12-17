import { describe, it, expect } from 'vitest'
import { createClickHouseClient } from '../src'
import type { Config } from '../src/config'

describe('ClickHouse Client', () => {
  it('should create client with valid config', async () => {
    const config: Config = {
      url: 'http://localhost:8123',
      database: 'test_db',
      username: 'default',
      password: '',
      oplogTable: 'oplog',
      dataTable: 'data'
    }
    const client = await createClickHouseClient(config)
    expect(client).toBeDefined()
  })
})
