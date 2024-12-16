import { openai } from '@ai-sdk/openai'
import { embed } from 'ai'

export interface EmbeddingOptions {
  model?: typeof openai.embedding
  dimensions?: number
}

export interface EmbeddingResult {
  vector: number[]
  text: string
}

export const defaultEmbeddingOptions: EmbeddingOptions = {
  model: openai.embedding('text-embedding-3-large'),
  dimensions: 256
}

export async function createEmbedding(text: string, options: EmbeddingOptions = defaultEmbeddingOptions): Promise<EmbeddingResult> {
  const { embedding } = await embed({
    model: options.model ?? defaultEmbeddingOptions.model,
    value: text,
    dimensions: options.dimensions ?? defaultEmbeddingOptions.dimensions
  })

  return {
    vector: embedding,
    text
  }
}
