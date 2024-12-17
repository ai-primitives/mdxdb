import OpenAI from 'openai'
import type { AIServiceConfig, GenerateOptions, EnhanceOptions, ErrorResolutionOptions, GenerateResult, EnhanceResult, ErrorResolutionResult } from './types'

export class MDXAIService {
  private openai: OpenAI
  private config: Required<AIServiceConfig>

  constructor(config: AIServiceConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY ?? '',
      model: config.model ?? 'gpt-4-turbo-preview',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048
    }

    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required')
    }

    this.openai = new OpenAI({
      apiKey: this.config.apiKey
    })
  }

  async generateContent(options: GenerateOptions): Promise<GenerateResult> {
    const { type, prompt, format = 'mdx', metadata = {} } = options

    const systemPrompt = `You are an expert MDX content generator. Generate high-quality ${format.toUpperCase()} content for the type: ${type}.
    The content should be well-structured and follow MDX best practices.`

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    })

    const content = response.choices[0]?.message?.content ?? ''
    return { content, metadata }
  }

  async enhanceContent(options: EnhanceOptions): Promise<EnhanceResult> {
    const { content, instructions = 'Enhance the MDX content while preserving its structure', preserveStructure = true } = options

    const systemPrompt = `You are an expert MDX content enhancer. ${preserveStructure ? 'Preserve the existing structure while making improvements.' : 'Feel free to restructure the content for better organization.'}`

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${instructions}\n\nContent:\n${content}` }
      ]
    })

    const enhancedContent = response.choices[0]?.message?.content ?? content
    const changes = ['Content enhanced based on instructions']

    return { content: enhancedContent, changes }
  }

  async resolveError(options: ErrorResolutionOptions): Promise<ErrorResolutionResult> {
    const { error, content, context = '' } = options

    const systemPrompt = `You are an expert at resolving MDX and ESBuild compilation errors. Analyze the error and provide a solution that fixes the issue while maintaining the content's integrity.`

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      temperature: 0.3, // Lower temperature for more focused problem-solving
      max_tokens: this.config.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Error:\n${error}\n\nContent:\n${content}\n\nContext:\n${context}` }
      ]
    })

    const solution = response.choices[0]?.message?.content ?? ''
    const [explanation, fixedContent] = solution.split('---\n')

    return {
      fixedContent: fixedContent?.trim() ?? content,
      explanation: explanation?.trim() ?? 'No explanation provided',
      changes: ['Applied error resolution fixes']
    }
  }
}
