import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDeploymentRouter, deployToCloudflare } from '../src/deployment'
import { Hono } from 'hono'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Deployment Service', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('deployToCloudflare', () => {
    it('should successfully deploy script to Cloudflare Workers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          result: {
            id: 'test-id',
            etag: 'test-etag'
          }
        })
      })

      const result = await deployToCloudflare('test script', {
        accountId: 'test-account',
        namespace: 'test-namespace',
        name: 'test-script',
        token: 'test-token'
      })

      expect(result.success).toBe(true)
      expect(result.result).toEqual({
        id: 'test-id',
        etag: 'test-etag'
      })
    })

    it('should handle deployment errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          success: false,
          errors: [{ message: 'Invalid script' }]
        })
      })

      const result = await deployToCloudflare('invalid script', {
        accountId: 'test-account',
        namespace: 'test-namespace',
        name: 'test-script',
        token: 'test-token'
      })

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Invalid script')
    })
  })

  describe('Deployment Router', () => {
    let app: Hono

    beforeEach(() => {
      app = new Hono()
      app.route('/api', createDeploymentRouter())
    })

    it('should handle valid deployment request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          result: {
            id: 'test-id',
            etag: 'test-etag'
          }
        })
      })

      const res = await app.request('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountId: 'test-account',
          namespace: 'test-namespace',
          name: 'test-script',
          script: 'test script',
          token: 'test-token'
        })
      })

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.result).toBeDefined()
    })

    it('should validate request body', async () => {
      const res = await app.request('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing required fields
          script: 'test script'
        })
      })

      const body = await res.json()
      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.errors).toBeDefined()
    })
  })
})
