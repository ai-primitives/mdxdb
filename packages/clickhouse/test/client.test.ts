import { describe, it, expect, vi } from 'vitest'
import { createClickHouseClient } from '../src'
import type { Config } from '../src/config'
import { createClient } from '@clickhouse/client-web'

vi.mock('@clickhouse/client-web', () => ({
  createClient: vi.fn().mockReturnValue({
    ping: vi.fn().mockResolvedValue({ success: true }),
    exec: vi.fn().mockResolvedValue({ success: true }),
    query: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        json: () => Promise.resolve([{ version: '24.11.0' }])
      })
    })
  })
}))

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
    expect(createClient).toHaveBeenCalledWith({
      host: config.url,
      username: config.username,
      password: config.password,
      database: config.database
    })
  })
})
