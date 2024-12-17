import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MDXAIService } from '../src/service'
import type { AIServiceConfig } from '../src/types'

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: '# Test Content\n\nThis is test content.'
                }
              }
            ]
          })
        }
      }
    }
  }
})

describe('MDXAIService', () => {
  let service: MDXAIService
  const config: AIServiceConfig = {
    apiKey: 'test-key',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000
  }

  beforeEach(() => {
    service = new MDXAIService(config)
  })

  describe('generateContent', () => {
    it('should generate MDX content with specified type', async () => {
      const result = await service.generateContent({
        type: 'blog-post',
        prompt: 'Write a blog post about TypeScript',
        format: 'mdx'
      })

      expect(result.content).toContain('# Test Content')
      expect(result.metadata).toBeDefined()
    })

    it('should handle missing format parameter', async () => {
      const result = await service.generateContent({
        type: 'documentation',
        prompt: 'Write documentation for a function'
      })

      expect(result.content).toBeDefined()
    })
  })

  describe('enhanceContent', () => {
    it('should enhance MDX content while preserving structure', async () => {
      const result = await service.enhanceContent({
        content: '# Original Content\n\nThis needs improvement.',
        preserveStructure: true
      })

      expect(result.content).toBeDefined()
      expect(result.changes).toHaveLength(1)
    })

    it('should enhance content with custom instructions', async () => {
      const result = await service.enhanceContent({
        content: '# Content\n\nImprove this.',
        instructions: 'Add more examples and explanations'
      })

      expect(result.content).toBeDefined()
      expect(result.changes).toContain('Content enhanced based on instructions')
    })
  })

  describe('resolveError', () => {
    it('should resolve MDX compilation errors', async () => {
      const result = await service.resolveError({
        error: 'SyntaxError: Unexpected token',
        content: '# Broken MDX\n\nThis <Component has errors',
        context: 'ESBuild compilation'
      })

      expect(result.fixedContent).toBeDefined()
      expect(result.explanation).toBeDefined()
      expect(result.changes).toHaveLength(1)
    })

    it('should handle missing context parameter', async () => {
      const result = await service.resolveError({
        error: 'TypeError: Cannot read property',
        content: '# Error Content\n\nThis needs fixing'
      })

      expect(result.fixedContent).toBeDefined()
      expect(result.explanation).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should throw error when API key is missing', () => {
      expect(() => new MDXAIService({ apiKey: '' })).toThrow('OpenAI API key is required')
    })

    it('should use environment variable for API key when not provided', () => {
      process.env.OPENAI_API_KEY = 'env-test-key'
      expect(() => new MDXAIService()).not.toThrow()
      delete process.env.OPENAI_API_KEY
    })
  })
})
