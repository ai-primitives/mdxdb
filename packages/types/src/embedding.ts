export interface EmbeddingOptions {
  dimensions?: number
  model?: string
}

export interface EmbeddingProvider {
  embed(text: string, options?: EmbeddingOptions): Promise<number[]>
}
