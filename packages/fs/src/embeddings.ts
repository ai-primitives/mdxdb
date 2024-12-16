import { openai } from '@ai-sdk/openai'

export class EmbeddingsService {
  constructor(apiKey: string) {
    // Configure the OpenAI provider with the API key
    Object.assign(openai, { apiKey })
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = openai.embedding('text-embedding-3-large', {
        dimensions: 256
      })
      const result = await model.doEmbed({
        values: [text]
      })

      if (!result.embeddings?.[0]) {
        throw new Error('No embedding generated')
      }

      return result.embeddings[0]
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to generate embedding: ${message}`)
    }
  }

  calculateSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimensions')
    }

    // Calculate cosine similarity manually
    const dotProduct = vec1.reduce((sum, v1, i) => sum + v1 * vec2[i], 0)
    const mag1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0))
    const mag2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0))

    // Handle zero magnitude vectors to prevent division by zero
    if (mag1 === 0 || mag2 === 0) {
      return 0
    }

    return dotProduct / (mag1 * mag2)
  }
}
