# @mdxdb/ai

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

AI-powered content generation and enhancement for MDX documents. This package provides integration with OpenAI's services for advanced features like content generation, semantic analysis, and text embeddings.

## Features

- 🤖 **AI Content Generation**: Generate MDX content using OpenAI's language models
- 🔍 **Semantic Analysis**: Analyze and enhance MDX content using AI
- 📊 **Text Embeddings**: Generate embeddings for vector search capabilities
- ⚡ **Async/Await API**: Modern Promise-based interface
- 🔒 **Error Handling**: Comprehensive error handling for AI operations

## Installation

```bash
npm install @mdxdb/ai
```

## Usage

```typescript
import { MDXAIService } from '@mdxdb/ai'

// Initialize the AI service
const aiService = new MDXAIService({
  apiKey: process.env.OPENAI_API_KEY
})

// Generate content
const content = await aiService.generateContent({
  prompt: 'Write a blog post about TypeScript',
  format: 'mdx'
})

// Generate embeddings for vector search
const embeddings = await aiService.generateEmbeddings({
  text: 'Your MDX content here'
})
```

## Configuration

```typescript
interface AIServiceConfig {
  apiKey: string
  model?: string // Default: 'gpt-4'
  temperature?: number // Default: 0.7
  maxTokens?: number // Default: 1000
}
```

## Error Handling

```typescript
try {
  const content = await aiService.generateContent({
    prompt: 'Write a blog post'
  })
} catch (error) {
  if (error instanceof AIServiceError) {
    console.error('AI service error:', error.message)
  }
}
```

## Dependencies

- @mdxdb/types: Core type definitions
- openai: OpenAI API client for AI operations
