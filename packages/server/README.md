# @mdxdb/server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Server implementation for MDXDB that provides a complete HTTP API for MDX document management. Built on top of Hono, this package enables you to deploy a fully-featured MDX database server with support for multiple database providers.

## Features

- 🚀 **Multiple Providers**: Support for FS and ClickHouse providers
- 🌐 **HTTP API**: RESTful API for document operations
- 🔍 **Vector Search**: Built-in semantic search capabilities
- 🔒 **Authentication**: Configurable authentication middleware
- 📊 **Metrics**: Built-in performance monitoring
- 🎯 **Type Safety**: Full TypeScript support

## Installation

```bash
npm install @mdxdb/server
```

## Usage

```typescript
import { createServer } from '@mdxdb/server'
import { FSProvider } from '@mdxdb/fs'
import { ClickHouseProvider } from '@mdxdb/clickhouse'

// Create a server with filesystem provider
const fsServer = createServer({
  provider: new FSProvider({
    directory: './data'
  })
})

// Create a server with ClickHouse provider
const chServer = createServer({
  provider: new ClickHouseProvider({
    host: 'localhost',
    database: 'mdxdb'
  })
})

// Start the server
const port = 3000
fsServer.listen(port)
```

## API Routes

```typescript
// Document Operations
POST   /documents          // Create document
GET    /documents/:id     // Get document by ID
PUT    /documents/:id     // Update document
DELETE /documents/:id     // Delete document
GET    /documents        // List documents

// Search Operations
POST   /search           // Full-text search
POST   /search/vector    // Vector similarity search

// Collection Operations
POST   /collections      // Create collection
GET    /collections/:name // Get collection info
```

## Configuration

```typescript
interface ServerConfig {
  provider: DatabaseProvider
  auth?: AuthConfig
  cors?: CORSConfig
  cache?: CacheConfig
  metrics?: MetricsConfig
}
```

## Error Handling

```typescript
app.onError((err, c) => {
  if (err instanceof DatabaseError) {
    return c.json({
      error: err.message,
      code: err.code
    }, err.status)
  }
  return c.json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR'
  }, 500)
})
```

## Dependencies

- @mdxdb/types: Core type definitions
- @mdxdb/fs: Filesystem provider implementation
- @mdxdb/clickhouse: ClickHouse provider implementation
- hono: HTTP server framework
