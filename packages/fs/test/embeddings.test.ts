import { describe, it, expect, vi, beforeEach } from 'vitest'
import { openai } from '@ai-sdk/openai'
import { EmbeddingsService } from '../src/embeddings'

// Mock the OpenAI provider
vi.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: vi.fn(),
  }
}))

describe('EmbeddingsService', () => {
  let service: EmbeddingsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new EmbeddingsService('test-api-key')
  })

  describe('generateEmbedding', () => {
    it('should generate embeddings successfully', async () => {
      const mockEmbedding = Array(256).fill(0.1)
      const mockDoEmbed = vi.fn().mockResolvedValue({
        embeddings: [mockEmbedding]
      })

      vi.mocked(openai.embedding).mockReturnValue({
        doEmbed: mockDoEmbed
      } as any)

      const result = await service.generateEmbedding('test text')

      expect(openai.embedding).toHaveBeenCalledWith('text-embedding-3-large', {
        dimensions: 256
      })
      expect(mockDoEmbed).toHaveBeenCalledWith({
        values: ['test text']
      })
      expect(result).toEqual(mockEmbedding)
    })

    it('should throw error when embedding generation fails', async () => {
      const mockDoEmbed = vi.fn().mockRejectedValue(new Error('API error'))

      vi.mocked(openai.embedding).mockReturnValue({
        doEmbed: mockDoEmbed
      } as any)

      await expect(service.generateEmbedding('test text')).rejects.toThrow(
        'Failed to generate embedding: API error'
      )
    })

    it('should throw error when no embedding is returned', async () => {
      const mockDoEmbed = vi.fn().mockResolvedValue({
        embeddings: []
      })

      vi.mocked(openai.embedding).mockReturnValue({
        doEmbed: mockDoEmbed
      } as any)

      await expect(service.generateEmbedding('test text')).rejects.toThrow(
        'Failed to generate embedding: No embedding generated'
      )
    })
  })

  describe('calculateSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vec1 = [1, 0]
      const vec2 = [1, 0]
      const result = service.calculateSimilarity(vec1, vec2)
      expect(result).toBe(1)
    })

    it('should handle perpendicular vectors', () => {
      const vec1 = [1, 0]
      const vec2 = [0, 1]
      const result = service.calculateSimilarity(vec1, vec2)
      expect(result).toBe(0)
    })

    it('should handle opposite vectors', () => {
      const vec1 = [1, 0]
      const vec2 = [-1, 0]
      const result = service.calculateSimilarity(vec1, vec2)
      expect(result).toBe(-1)
    })

    it('should handle zero magnitude vectors', () => {
      const vec1 = [0, 0]
      const vec2 = [1, 0]
      const result = service.calculateSimilarity(vec1, vec2)
      expect(result).toBe(0)
    })

    it('should throw error for vectors with different dimensions', () => {
      const vec1 = [1, 0]
      const vec2 = [1]
      expect(() => service.calculateSimilarity(vec1, vec2)).toThrow(
        'Vectors must have the same dimensions'
      )
    })
  })
})
