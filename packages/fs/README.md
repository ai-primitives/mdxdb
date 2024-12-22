# @mdxdb/fs

[![npm version](https://badge.fury.io/js/@mdxdb%2Ffs.svg)](https://www.npmjs.com/package/@mdxdb/fs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Filesystem provider for MDXDB that enables local storage and vector search capabilities. This package implements the database provider interface using the local filesystem, providing efficient document storage and retrieval with vector similarity search support.

## Features

- 📁 **File-based Storage**: Efficient document storage in the filesystem
- 🔍 **Vector Search**: Built-in vector similarity search
- 🔄 **Atomic Operations**: Safe concurrent document operations
- 📊 **Metadata Storage**: Efficient storage of document metadata
- 🔒 **Type Safety**: Full TypeScript support with type definitions
- 🚀 **Performance**: Optimized for fast read and write operations

## Installation

```bash
npm install @mdxdb/fs
```

## Usage

```typescript
import { FSProvider } from '@mdxdb/fs'

// Initialize the provider
const provider = new FSProvider({
  directory: './data',
  embeddings: {
    dimensions: 256,
    similarity: 'cosine'
  }
})

// Connect to the database
await provider.connect()

// Get a collection
const posts = provider.collection('posts')

// Create a document
const post = await posts.create({
  mdx: '# Hello World\nThis is my first post!',
  data: {
    title: 'Hello World',
    published: true
  }
})

// Vector search
const similar = await posts.semanticSearch('concept', {
  k: 5,
  threshold: 0.7
})
```

## Configuration

```typescript
interface FSConfig {
  directory: string
  embeddings?: {
    dimensions: number
    similarity: 'cosine' | 'euclidean'
    threshold?: number
  }
  compression?: boolean
  atomic?: boolean
}
```

## File Structure

The provider creates the following directory structure:

```
data/
  ├── collections/
  │   └── posts/
  │       ├── documents/
  │       │   └── {id}.json
  │       ├── embeddings/
  │       │   └── {id}.bin
  │       └── metadata.json
  └── index.json
```

## Dependencies

- @mdxdb/types: Core type definitions
- @ai-sdk/openai: OpenAI integration for embeddings
- @ai-sdk/provider: AI provider interface
- ai: AI utilities and helpers
- mdxld: MDX loader and processor
