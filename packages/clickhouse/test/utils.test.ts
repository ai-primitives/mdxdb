import { describe, it, expect } from 'vitest'
import { deriveNamespace, checkClickHouseVersion } from '../src/utils.js'
import type { ClickHouseClient } from '@clickhouse/client-web'

describe('ClickHouse Utils', () => {
  describe('deriveNamespace', () => {
    it('should derive namespace from domain path', () => {
      const testCases = [
        { input: 'docs.example.com/api', expected: 'docs.example.com' },
        { input: 'blog.example.com/posts/first', expected: 'blog.example.com' },
        { input: 'api.example.com/v1/users', expected: 'api.example.com' }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(deriveNamespace(input)).toBe(expected)
      })
    })

    it('should derive namespace from root domain', () => {
      const testCases = [
        { input: 'docs.example.com', expected: 'example.com' },
        { input: 'blog.example.com', expected: 'example.com' },
        { input: 'api.example.com', expected: 'example.com' }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(deriveNamespace(input)).toBe(expected)
      })
    })

    it('should handle invalid inputs gracefully', () => {
      const testCases = [
        { input: '', expected: '' },
        { input: 'invalid-url', expected: 'invalid-url' },
        { input: 'http://example.com', expected: 'example.com' }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(deriveNamespace(input)).toBe(expected)
      })
    })
  })

  describe('checkClickHouseVersion', () => {
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
})
