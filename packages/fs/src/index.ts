import { DatabaseProvider, CollectionProvider, Document } from '@mdxdb/types'
import { promises as fs } from 'fs'
import path from 'path'
import { FSCollection } from './collection'
import { EmbeddingsService } from './embeddings'
import { EmbeddingsStorageService } from './storage'

class FSDatabase implements DatabaseProvider<Document> {
  readonly namespace: string
  private collections: Set<string>
  private basePath: string

  constructor(basePath: string) {
    this.namespace = `file://${path.resolve(basePath)}`
    this.collections = new Set()
    this.basePath = basePath
  }

  async connect(): Promise<void> {
    // Ensure base directory exists
    await fs.mkdir(this.basePath, { recursive: true })

    // Load existing collections
    const entries = await fs.readdir(this.basePath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        this.collections.add(entry.name)
      }
    }
  }

  async disconnect(): Promise<void> {
    // No cleanup needed for filesystem
  }

  async list(): Promise<string[]> {
    return Array.from(this.collections)
  }

  collection(name: string): CollectionProvider<Document> {
    this.collections.add(name)
    return new FSCollection(this.basePath, name)
  }

  get docs(): DatabaseProvider<Document> {
    return {
      namespace: this.namespace,
      connect: () => this.connect(),
      disconnect: () => this.disconnect(),
      list: () => this.list(),
      collection: (name: string) => this.collection(name),
      get docs() {
        return this
      }
    } as DatabaseProvider<Document>
  }
}

function createDatabase(options: { basePath: string }): DatabaseProvider<Document> {
  return new FSDatabase(options.basePath)
}

export { FSDatabase, createDatabase, EmbeddingsService, EmbeddingsStorageService }
