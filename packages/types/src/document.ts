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
  public readonly id: string
  public content: string
  public data: {
    $id: string
    $type: string
    $context?: string | Record<string, unknown>
    [key: string]: unknown
  }
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
  }
  public embeddings?: number[]
  public collections: string[]

  constructor(
    id: string,
    content: string = '',
    data: {
      [key: string]: unknown
      $id?: string
      $type?: string
      $context?: string | Record<string, unknown>
    } = {},
    metadata: Record<string, unknown> = {},
    embeddings?: number[],
    collections: string[] = []
  ) {
    this.id = id // Keep id at root level for JSON-LD compatibility
    this.content = content
    this.data = {
      ...data,
      $id: id, // Ensure $id is set in data
      $type: (metadata.type as string) || 'document'
    }
    this.metadata = {
      id: id,
      type: (metadata.type as string) || 'document',
      ts: (metadata.ts as number) || Date.now(),
      ...(metadata as Record<string, unknown>)
    }
    this.embeddings = embeddings
    this.collections = collections
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
