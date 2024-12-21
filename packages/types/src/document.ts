/**
 * Base implementation of Document interface
 */
import { MDXLD } from './mdxld'

export interface Document extends MDXLD {
  getId(): string
  getType(): string
  getCollections(): string[]
  belongsToCollection(collection: string): boolean
  getEmbeddings(): number[] | undefined
}

export class BaseDocument implements Document {
  constructor(
    public id: string,
    public content: string,
    public data: {
      $id: string
      $type: string
      $context?: string | Record<string, unknown>
      [key: string]: unknown
    } = { $id: '', $type: 'document' },
    public metadata: {
      id: string
      type: string
      ts?: number
      ns?: string
      host?: string
      path?: string[]
      content?: string
      data?: Record<string, unknown>
      version?: number
      hash?: Record<string, unknown>
      [key: string]: unknown
    } = { id: '', type: 'document', ts: Date.now() },
    public embeddings?: number[],
    public collections?: string[]
  ) {
    this.data.$id = id
    this.data.$type = metadata.type || 'document'
    this.metadata.id = id
    this.metadata.type = metadata.type || 'document'
    this.metadata.ts = metadata.ts || Date.now()
  }

  getId(): string {
    return this.id
  }

  getType(): string {
    return this.metadata.type
  }

  getCollections(): string[] {
    return this.collections || []
  }

  belongsToCollection(collection: string): boolean {
    return this.collections?.includes(collection) || false
  }

  getEmbeddings(): number[] | undefined {
    return this.embeddings
  }
}
