export interface EmbeddingModel<T = unknown> {
  embed(input: string): Promise<number[]>
  dimensions?: number
  metadata?: T
}

export interface EmbeddingOptions<T = unknown> {
  model: EmbeddingModel<T>
}

export interface EmbeddingResult {
  vector: number[]
  text: string
}
