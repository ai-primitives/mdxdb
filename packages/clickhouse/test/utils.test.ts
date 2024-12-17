import { describe, it, expect } from 'vitest'
import { checkClickHouseVersion } from '../src/utils'
import type { ClickHouseClient } from '@clickhouse/client'

describe('Utils', () => {
  it('should validate ClickHouse version requirements', async () => {
    const mockClient = {
      query: async () => ({
        json: async () => [{ version: '24.10.0' }]
      })
    } as unknown as ClickHouseClient

    await expect(checkClickHouseVersion(mockClient)).resolves.not.toThrow()
  })

  it('should throw error for unsupported ClickHouse version', async () => {
    const mockClient = {
      query: async () => ({
        json: async () => [{ version: '24.9.0' }]
      })
    } as unknown as ClickHouseClient

    await expect(checkClickHouseVersion(mockClient)).rejects.toThrow('ClickHouse v24.10+ is required')
  })
})
