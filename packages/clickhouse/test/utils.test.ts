import { describe, it, expect, vi } from 'vitest'
import { checkClickHouseVersion } from '../src/utils'
import type { ClickHouseClient } from '@clickhouse/client'

describe('ClickHouse Utils', () => {
  it('should check ClickHouse version', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        json: () => Promise.resolve([{ version: '24.10.0' }])
      })
    } as unknown as ClickHouseClient

    await expect(checkClickHouseVersion(mockClient)).resolves.not.toThrow()
  })

  it('should throw error for unsupported version', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        json: () => Promise.resolve([{ version: '24.9.0' }])
      })
    } as unknown as ClickHouseClient

    await expect(checkClickHouseVersion(mockClient)).rejects.toThrow('ClickHouse v24.10+ is required')
  })
})
