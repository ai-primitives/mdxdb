import { CollectionProvider, Document, FilterQuery, SearchOptions, VectorSearchOptions } from '@mdxdb/types'
import { promises as fs } from 'fs'
import * as nodePath from 'path'
import { EmbeddingsService } from './embeddings'
import { EmbeddingsStorageService } from './storage'

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
      return {
        id,
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

  async create(id: string, document: Document): Promise<void> {
    const existingDoc = await this.readDocument(id)
    if (existingDoc) {
      throw new Error(`Document with id ${id} already exists`)
    }
    await this.writeDocument(id, document)
  }

  async read(id: string): Promise<Document | null> {
    return this.readDocument(id)
  }

  async update(id: string, document: Document): Promise<void> {
    const existingDoc = await this.readDocument(id)
    if (!existingDoc) {
      throw new Error(`Document with id ${id} not found`)
    }
    await this.writeDocument(id, document)
  }

  async delete(id: string): Promise<void> {
    const filePath = nodePath.join(this.collectionPath, `${id}.mdx`)
    try {
      await fs.unlink(filePath)
      await this.storageService.deleteEmbedding(id)
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        throw error
      }
    }
  }

  async find(filter: FilterQuery<Document>): Promise<Document[]> {
    const docs = await this.getAllDocuments()
    const results = docs.map(doc => doc.content)

    if (!filter || Object.keys(filter).length === 0) {
      return results
    }

    const filterEntries = Object.entries(filter)
    const filteredResults = results.filter(doc => {
      return filterEntries.every(([key, value]) => {
        if (key === 'content' && typeof value === 'string') {
          return doc.content.includes(value)
        }
        if (key === 'id' && typeof value === 'string') {
          return doc.id === value
        }
        if (key === 'data' && typeof value === 'object') {
          return Object.entries(value as Record<string, unknown>).every(
            ([dataKey, dataValue]) => doc.data[dataKey] === dataValue
          )
        }
        return false
      })
    })

    return filteredResults
  }

  async search(query: string, options?: SearchOptions<Document>): Promise<Document[]> {
    const queryEmbedding = await this.embeddingsService.generateEmbedding(query)
    return this.vectorSearch({
      ...options,
      vector: queryEmbedding,
      threshold: options?.threshold ?? 0.7
    })
  }

  async vectorSearch(options: Required<Pick<VectorSearchOptions, 'vector'>> & SearchOptions<Document>): Promise<Document[]> {
    const docs = await this.getAllDocuments()
    const threshold = options.threshold ?? 0.7

    const results = await Promise.all(
      docs.map(async ({ id, content }) => {
        const storedEmbedding = await this.storageService.getEmbedding(id)
        if (!storedEmbedding?.embedding) {
          console.debug(`No embedding found for document ${id}`)
          return { doc: content, similarity: 0 }
        }

        const similarity = this.embeddingsService.calculateSimilarity(
          options.vector,
          storedEmbedding.embedding
        )
        console.debug(`Document ${id} similarity: ${similarity}`)
        return { doc: content, similarity }
      })
    )

    const filteredResults = results
      .filter(result => {
        const passes = result.similarity >= threshold
        console.debug(`Filtering result with similarity ${result.similarity}, threshold ${threshold}, passes: ${passes}`)
        return passes
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.limit || 10)

    return filteredResults.map(result => result.doc)
  }
}
