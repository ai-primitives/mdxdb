export interface AIServiceConfig {
  apiKey?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface GenerateOptions {
  type: string
  prompt: string
  format?: 'mdx' | 'jsx'
  metadata?: Record<string, unknown>
}

export interface EnhanceOptions {
  content: string
  instructions?: string
  preserveStructure?: boolean
}

export interface ErrorResolutionOptions {
  error: string
  content: string
  context?: string
}

export interface GenerateResult {
  content: string
  metadata?: Record<string, unknown>
}

export interface EnhanceResult {
  content: string
  changes: string[]
}

export interface ErrorResolutionResult {
  fixedContent: string
  explanation: string
  changes: string[]
}
