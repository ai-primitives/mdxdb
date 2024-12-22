# @mdxdb/fetch

[![npm version](https://badge.fury.io/js/@mdxdb%2Ffetch.svg)](https://www.npmjs.com/package/@mdxdb/fetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

HTTP/API provider for MDXDB that enables remote interaction with MDX collections. This package provides a client implementation for accessing MDX documents over HTTP, supporting all standard collection operations with proper error handling.

## Features

- 🌐 **HTTP Client**: Full-featured HTTP client for MDX collections
- 🔄 **RESTful API**: Standard REST endpoints for all operations
- 🔒 **Authentication**: Built-in support for API keys and tokens
- ⚡ **Async/Await**: Modern Promise-based API
- 🚦 **Error Handling**: Comprehensive HTTP error handling
- 📊 **Response Types**: Type-safe response handling

## Installation

```bash
npm install @mdxdb/fetch
```

## Usage

```typescript
import { createClient } from '@mdxdb/fetch'

// Initialize the client
const client = createClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key'
})

// Get a collection
const posts = client.collection('posts')

// Create a document
const post = await posts.create({
  mdx: '# Hello World\nThis is my first post!',
  data: {
    title: 'Hello World',
    published: true
  }
})

// Search documents
const results = await posts.search('hello')

// Vector search
const similar = await posts.semanticSearch('concept', {
  k: 5,
  threshold: 0.7
})
```

## Configuration

```typescript
interface ClientConfig {
  baseUrl: string
  apiKey?: string
  headers?: Record<string, string>
  timeout?: number
}
```

## Error Handling

```typescript
try {
  const doc = await posts.get('non-existent')
} catch (error) {
  if (error instanceof HTTPError) {
    console.error('HTTP error:', error.status, error.message)
  }
}
```

## Dependencies

- @mdxdb/types: Core type definitions for MDXDB
