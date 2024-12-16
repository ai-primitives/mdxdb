import { openai } from '@ai-sdk/openai'
import { embed, type EmbeddingModel } from 'ai'

export interface EmbeddingOptions {
  model?: EmbeddingModel<string>
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
  // Ensure model is always defined by using defaultEmbeddingOptions.model as fallback
  const model = options.model ?? defaultEmbeddingOptions.model
  if (!model) {
    throw new Error('Embedding model must be defined')
  }

  const { embedding: vector } = await embed({
    model,
    value: text
  })

  return {
    vector,
    text
  }
}
