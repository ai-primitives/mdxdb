import { Document } from '@mdxdb/types'

export class FSDocument implements Document {
  constructor(
    public readonly id: string,
    public content: string = '',
    public data: {
      $id: string
      $type: string
      $context?: string | Record<string, unknown>
      [key: string]: unknown
    } = {
      $id: '',
      $type: 'document'
    },
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
    } = {
      id: '',
      type: 'document'
    },
    public embeddings?: number[],
    public collections: string[] = []
  ) {
    // Ensure required fields are set
    this.data = {
      ...data,
      $id: id,
      $type: metadata.type || 'document'
    }
    this.metadata = {
      ...metadata,
      id: id,
      type: metadata.type || 'document',
      ts: metadata.ts || Date.now()
    }
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
