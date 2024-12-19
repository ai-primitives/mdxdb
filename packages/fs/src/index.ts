import { DatabaseProvider, CollectionProvider, Document } from '@mdxdb/types'
import { promises as fs } from 'fs'
import path from 'path'
import { FSCollection } from './collection'
import { EmbeddingsService } from './embeddings'
import { EmbeddingsStorageService } from './storage'

const collectionsSymbol = Symbol('collections')

class FSDatabase implements DatabaseProvider<Document> {
  readonly namespace: string
  protected [collectionsSymbol]: Set<string>
  public collections: CollectionProvider<Document>

  constructor(private basePath: string) {
    this.namespace = `file://${path.resolve(basePath)}`
    this[collectionsSymbol] = new Set()
    this.collections = new FSCollection(this.basePath, '')
  }

  async connect(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true })
    const entries = await fs.readdir(this.basePath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        this[collectionsSymbol].add(entry.name)
      }
    }
  }

  async disconnect(): Promise<void> {}

  async query<T>(_query: string): Promise<T> {
    throw new Error('Query operations are not supported in the filesystem database')
  }

  async list(): Promise<string[]> {
    return Array.from(this[collectionsSymbol])
  }

  collection(name: string): CollectionProvider<Document> {
    this[collectionsSymbol].add(name)
    return new FSCollection(this.basePath, name)
  }

  get docs(): DatabaseProvider<Document> {
    return this
  }
}

function createDatabase(options: { basePath: string }): DatabaseProvider<Document> {
  return new FSDatabase(options.basePath)
}

export { FSDatabase, createDatabase, EmbeddingsService, EmbeddingsStorageService }
