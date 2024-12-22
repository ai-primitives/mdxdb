# @mdxdb/types

[![npm version](https://badge.fury.io/js/@mdxdb%2Ftypes.svg)](https://www.npmjs.com/package/@mdxdb/types)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Core type definitions and interfaces for the MDXDB ecosystem. This package provides the foundational types used across all MDXDB packages, ensuring type safety and consistency throughout the system.

## Features

- 📝 **Document Types**: Core interfaces for MDX documents and collections
- 🔍 **Search Types**: Comprehensive types for vector and semantic search
- 🌐 **Provider Interfaces**: Database and collection provider definitions
- 🔒 **Error Types**: Detailed error type definitions
- 📊 **Configuration Types**: Type definitions for package configurations

## Installation

```bash
npm install @mdxdb/types
```

## Usage

```typescript
import type { Document, Collection, DatabaseProvider } from '@mdxdb/types'

// Define a document
interface BlogPost extends Document {
  data: {
    title: string
    published: boolean
  }
}

// Use collection types
const posts: Collection<BlogPost> = {
  // Implementation
}

// Implement a database provider
class CustomProvider implements DatabaseProvider<BlogPost> {
  // Implementation
}
```

## Type Definitions

### Document Interface
```typescript
interface Document {
  id: string
  mdx: string
  data: Record<string, any>
  embeddings?: number[]
}
```

### Collection Interface
```typescript
interface Collection<T extends Document> {
  get(id: string): Promise<T>
  create(doc: Omit<T, 'id'>): Promise<T>
  update(id: string, doc: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
  search(query: string): Promise<T[]>
}
```

### Provider Interfaces
```typescript
interface DatabaseProvider<T extends Document> {
  connect(): Promise<void>
  disconnect(): Promise<void>
  collection(name: string): Collection<T>
}
```

## Dependencies

This package has no external dependencies, serving as a foundation for other MDXDB packages.
