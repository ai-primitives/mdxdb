# @mdxdb/clickhouse

[![npm version](https://badge.fury.io/js/@mdxdb%2Fclickhouse.svg)](https://www.npmjs.com/package/@mdxdb/clickhouse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

ClickHouse database provider for MDXDB that enables high-performance vector search and document storage. This package implements the database provider interface using ClickHouse as the backend, providing efficient vector similarity search and document management.

## Features

- 🚀 **Vector Search**: High-performance similarity search using HNSW index
- 📊 **Materialized Views**: Optimized query performance with materialized views
- 🔄 **Real-time Updates**: Support for real-time document updates
- 🔍 **Full-text Search**: Integrated full-text search capabilities
- 📈 **Scalability**: Horizontal scaling with ClickHouse clustering
- 🔒 **Type Safety**: Full TypeScript support with type definitions

## Installation

```bash
npm install @mdxdb/clickhouse
```

## Usage

```typescript
import { ClickHouseProvider } from '@mdxdb/clickhouse'

// Initialize the provider
const provider = new ClickHouseProvider({
  host: 'clickhouse.example.com',
  database: 'mdxdb',
  username: 'default',
  password: 'password'
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
interface ClickHouseConfig {
  host: string
  database: string
  username?: string
  password?: string
  port?: number
  protocol?: 'http' | 'https'
  maxRetries?: number
  timeout?: number
}
```

## Schema

The package automatically creates the following schema:

```sql
CREATE TABLE documents (
  id String,
  mdx String,
  data String, -- JSON encoded
  embeddings Array(Float32),
  created_at DateTime,
  updated_at DateTime
) ENGINE = MergeTree()
ORDER BY (id, created_at)
```

## Dependencies

- @mdxdb/types: Core type definitions
- @clickhouse/client-web: ClickHouse HTTP client
