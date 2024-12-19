import { CollectionProvider, Document, FilterQuery, SearchOptions, VectorSearchOptions, SearchResult } from '@mdxdb/types'
import { promises as fs } from 'fs'
import * as nodePath from 'path'
import { EmbeddingsService } from './embeddings'
import { EmbeddingsStorageService } from './storage'
import { webcrypto } from 'node:crypto'

export interface FSCollectionOptions {
  openaiApiKey?: string
}

export class FSCollection implements CollectionProvider<Document> {
  private embeddingsService: EmbeddingsService
  private storageService: EmbeddingsStorageService
  private collectionPath: string

  constructor(
    private basePath: string,
    public path: string,
    options?: FSCollectionOptions
  ) {
    this.embeddingsService = new EmbeddingsService(options?.openaiApiKey || process.env.OPENAI_API_KEY || '')
    this.storageService = new EmbeddingsStorageService(basePath)
    this.collectionPath = nodePath.join(basePath, path)
  }

  private async readDocument(id: string): Promise<Document | null> {
    try {
      const filePath = nodePath.join(this.collectionPath, `${id}.mdx`)
      const content = await fs.readFile(filePath, 'utf-8')
      const docId = id.split('/').pop() || id
      return {
        id: docId,
        content,
        data: {}
      }
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  private async writeDocument(id: string, document: Document): Promise<void> {
    const filePath = nodePath.join(this.collectionPath, `${id}.mdx`)
    const exists = await fs.access(filePath).then(() => true).catch(() => false)
    if (exists) {
      throw new Error(`Document with id ${id} already exists`)
    }
    await fs.mkdir(nodePath.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, document.content, 'utf-8')

    const embedding = await this.embeddingsService.generateEmbedding(document.content)
    await this.storageService.storeEmbedding(id, document.content, embedding)
  }

  private async updateDocument(id: string, document: Document): Promise<void> {
    const filePath = nodePath.join(this.collectionPath, `${id}.mdx`)
    await fs.mkdir(nodePath.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, document.content, 'utf-8')

    const embedding = await this.embeddingsService.generateEmbedding(document.content)
    await this.storageService.storeEmbedding(id, document.content, embedding)
  }

  private async getAllDocuments(): Promise<Array<{ id: string; content: Document }>> {
    try {
      await fs.mkdir(this.collectionPath, { recursive: true })
      const files = await fs.readdir(this.collectionPath)
      const mdxFiles = files.filter(file => file.endsWith('.mdx'))

      const documents = await Promise.all(
        mdxFiles.map(async file => {
          const id = nodePath.basename(file, '.mdx')
          const doc = await this.readDocument(id)
          return doc ? { id, content: doc } : null
        })
      )

      return documents.filter((doc): doc is { id: string; content: Document } => doc !== null)
    } catch (error) {
      throw new Error(`Failed to read documents: ${error}`)
    }
  }

  async create(collection: string): Promise<void> {
    await fs.mkdir(nodePath.join(this.collectionPath, collection), { recursive: true })
  }

  async insert(collection: string, document: Document): Promise<void> {
    const id = document.id || webcrypto.randomUUID()
    document.id = id
    const fullPath = nodePath.join(collection, id)
    await this.writeDocument(fullPath, document)
  }

  async findOne(collection: string, filter: FilterQuery<Document>): Promise<Document | null> {
    const collectionPath = nodePath.join(this.collectionPath, collection)
    const docs = await this.get(collection)
    const filtered = docs.filter(doc =>
      Object.entries(filter).every(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          const operators = value as Record<string, unknown>
          return Object.entries(operators).every(([op, val]) => {
            const docValue = doc[key as keyof Document]
            if (docValue === undefined) return false

            switch (op) {
              case '$eq': return docValue === val
              case '$gt': return typeof docValue === 'number' && typeof val === 'number' && docValue > val
              case '$gte': return typeof docValue === 'number' && typeof val === 'number' && docValue >= val
              case '$lt': return typeof docValue === 'number' && typeof val === 'number' && docValue < val
              case '$lte': return typeof docValue === 'number' && typeof val === 'number' && docValue <= val
              case '$in': return Array.isArray(val) && val.includes(docValue)
              case '$nin': return Array.isArray(val) && !val.includes(docValue)
              default: return false
            }
          })
        }
        return doc[key as keyof Document] === value
      })
    )
    return filtered[0] || null
  }

  async get(collection: string): Promise<Document[]> {
    const collectionPath = nodePath.join(this.collectionPath, collection)
    await fs.mkdir(collectionPath, { recursive: true })
    const files = await fs.readdir(collectionPath)
    const mdxFiles = files.filter(file => file.endsWith('.mdx'))

    const documents = await Promise.all(
      mdxFiles.map(async file => {
        const id = nodePath.basename(file, '.mdx')
        return this.readDocument(nodePath.join(collection, id))
      })
    )

    return documents.filter((doc): doc is Document => doc !== null)
  }

  async update(collection: string, filter: FilterQuery<Document>, document: Partial<Document>): Promise<void> {
    const docs = await this.get(collection)
    const filtered = docs.filter(doc =>
      Object.entries(filter).every(([key, value]) => doc[key as keyof Document] === value)
    )

    if (filtered.length === 0) {
      throw new Error('Document not found')
    }

    for (const doc of filtered) {
      if (!doc.id) continue // Skip documents without IDs
      const updatedDoc = { ...doc, ...document, id: doc.id }
      const fullPath = nodePath.join(collection, doc.id)
      await this.updateDocument(fullPath, updatedDoc)
    }
  }

  async delete(collection: string, filter: FilterQuery<Document>): Promise<void> {
    const docs = await this.get(collection)
    const filtered = docs.filter(doc =>
      Object.entries(filter).every(([key, value]) => doc[key as keyof Document] === value)
    )

    for (const doc of filtered) {
      if (!doc.id) continue // Skip documents without IDs
      const fullPath = nodePath.join(collection, doc.id)
      const filePath = nodePath.join(this.collectionPath, `${fullPath}.mdx`)
      try {
        await fs.unlink(filePath)
        await this.storageService.deleteEmbedding(fullPath)
      } catch (error) {
        if ((error as { code?: string }).code !== 'ENOENT') {
          throw error
        }
      }
    }
  }

  async find(filter: FilterQuery<Document>): Promise<Document[]> {
    const docs = await this.getAllDocuments()
    const filtered = docs.filter(({ content }) =>
      Object.entries(filter).every(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          const operators = value as Record<string, unknown>
          return Object.entries(operators).every(([op, val]) => {
            const docValue = content[key as keyof Document]
            if (docValue === undefined) return false

            switch (op) {
              case '$eq': return docValue === val
              case '$gt': return typeof docValue === 'number' && typeof val === 'number' && docValue > val
              case '$gte': return typeof docValue === 'number' && typeof val === 'number' && docValue >= val
              case '$lt': return typeof docValue === 'number' && typeof val === 'number' && docValue < val
              case '$lte': return typeof docValue === 'number' && typeof val === 'number' && docValue <= val
              case '$in': return Array.isArray(val) && val.includes(docValue)
              case '$nin': return Array.isArray(val) && !val.includes(docValue)
              default: return false
            }
          })
        }
        return content[key as keyof Document] === value
      })
    )
    return filtered.map(doc => doc.content)
  }

  async search(query: string, options?: SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    const queryEmbedding = await this.embeddingsService.generateEmbedding(query)
    return this.vectorSearch({
      ...options,
      vector: queryEmbedding,
      threshold: options?.threshold ?? 0.7
    })
  }

  async vectorSearch(options: VectorSearchOptions & SearchOptions<Document>): Promise<SearchResult<Document>[]> {
    if (!options.vector) {
      throw new Error('Vector is required for vector search')
    }

    const docs = await this.getAllDocuments()

    const results = await Promise.all(
      docs.map(async ({ id, content }) => {
        const storedEmbedding = await this.storageService.getEmbedding(id)
        if (!storedEmbedding?.embedding) {
          console.debug(`No embedding found for document ${id}`)
          return {
            document: content,
            score: 0
          }
        }

        const similarity = this.embeddingsService.calculateSimilarity(
          options.vector as number[],
          storedEmbedding.embedding
        )
        console.debug(`Document ${id} similarity: ${similarity}`)
        return {
          document: content,
          score: similarity
        }
      })
    )

    return results
      .filter(result => result.score >= (options.threshold ?? 0.7))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10)
  }
}
