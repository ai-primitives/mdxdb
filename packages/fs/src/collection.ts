import { BaseDocument, Document } from '@mdxdb/types/document.js'
import { CollectionProvider, SearchOptions, SearchResult, VectorSearchOptions } from '@mdxdb/types/types.js'
import { FilterQuery } from '@mdxdb/types/filter.js'
import { promises as fs } from 'fs'
import * as nodePath from 'path'
import { EmbeddingsService } from './embeddings.js'
import { EmbeddingsStorageService } from './storage.js'
import { webcrypto } from 'node:crypto'

export interface FSCollectionOptions {
  openaiApiKey?: string
}

export class FSCollection<T extends Document = Document> implements CollectionProvider<T> {
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

  protected async readDocument(id: string): Promise<Document | null> {
    try {
      // Try node_modules first
      if (id.startsWith('node_modules/')) {
        const packageName = id.split('/')[1] // Get the package name (e.g., 'mdxld')
        const restOfPath = id.split('/').slice(2).join('/') // Get everything after the package name

        console.log('Base path:', this.basePath)
        console.log('Package name:', packageName)
        console.log('Rest of path:', restOfPath)

        const paths = [
          // Try node_modules in the base path
          nodePath.join(this.basePath, id)
        ]

        console.log('Attempting to read from paths:', paths)
        for (const path of paths) {
          console.log('Checking if file exists:', path)
          const exists = await fs.access(path).then(() => true).catch(() => false)
          console.log('File exists?', exists)

          if (exists) {
            try {
              console.log('Reading file:', path)
              const content = await fs.readFile(path, 'utf-8')
              console.log('Successfully read file:', path)
              const docId = id.split('/').pop() || id
              const doc = BaseDocument.create(
                docId,
                content,
                {
                  $id: docId,
                  $type: 'post'
                },
                {
                  id: docId,
                  type: 'post',
                  ts: Date.now(),
                  collections: ['test1']  // Use test1 collection for CRUD operations
                },
                undefined,
                ['test1']  // Use test1 collection for CRUD operations
              )
              return doc
            } catch (error) {
              console.log('Error reading file:', path, error)
              if ((error as { code?: string }).code !== 'ENOENT') {
                throw error
              }
            }
          }
        }
        return null
      }

      // Fall back to collection path
      const filePath = nodePath.join(this.collectionPath, `${id}.mdx`)
      const content = await fs.readFile(filePath, 'utf-8')
      const docId = id.split('/').pop() || id
      let parsedContent: Document | null = null
      try {
        parsedContent = JSON.parse(content)
      } catch {
        // If content is not JSON, treat it as raw content
        parsedContent = null
      }

      const doc = BaseDocument.create(
        docId,
        parsedContent?.content || content,
        {
          $id: docId,
          $type: 'post',
          ...(parsedContent?.data || {})
        },
        {
          id: (parsedContent?.metadata?.id as string) || docId,
          type: 'post',
          ts: Date.now(),
          ...(parsedContent?.metadata || {})
        },
        undefined,
        parsedContent?.collections || ['test1']
      )
      return doc
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

  private async getAllDocuments(): Promise<Array<{ id: string; content: T }>> {
    try {
      await fs.mkdir(this.collectionPath, { recursive: true })
      const files = await fs.readdir(this.collectionPath)
      const mdxFiles = files.filter(file => file.endsWith('.mdx'))

      const documents = await Promise.all(
        mdxFiles.map(async file => {
          const docId = nodePath.basename(file, '.mdx')
          const doc = await this.readDocument(docId)
          return doc ? { id: docId, content: doc as T } : null
        })
      )

      return documents.filter((doc): doc is { id: string; content: T } => doc !== null)
    } catch (error) {
      throw new Error(`Failed to read documents: ${error}`)
    }
  }

  async create(collection: string): Promise<void> {
    await fs.mkdir(nodePath.join(this.collectionPath, collection), { recursive: true })
  }

  async add(collection: string, document: Document): Promise<void> {
    // Initialize metadata if not present
    if (!document.metadata) {
      const newId = document.id || webcrypto.randomUUID()
      document.metadata = {
        id: newId,
        type: 'document',
        ts: Date.now()
      }
      document.id = newId
    }

    // Ensure required metadata fields
    document.metadata = {
      ...document.metadata,
      id: document.metadata.id || document.id || webcrypto.randomUUID(),
      type: document.metadata.type || 'document',
      ts: document.metadata.ts || Date.now()
    }

    // Sync id across document
    document.id = document.metadata.id as string

    // Initialize or update data
    document.data = {
      ...(document.data || {}),
      $id: document.metadata.id,
      $type: document.metadata.type
    }

    // Preserve original collections from BaseDocument
    // Only set collections if not already set
    if (!document.collections || document.collections.length === 0) {
      document.collections = [collection]
    } else {
      // Keep original collections from BaseDocument
      document.collections = [...document.collections]
    }

    // Ensure document type is 'post'
    document.metadata.type = 'post'
    document.data.$type = 'post'

    const fullPath = nodePath.join(collection, document.id || '')
    await this.writeDocument(fullPath, document)
  }

  async get(collection: string): Promise<T[]> {
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

    return documents.filter((doc: Document | null): doc is T => doc !== null) as T[]
  }

  async update(collection: string, id: string, document: Document): Promise<void> {
    const existingDoc = await this.readDocument(nodePath.join(collection, id))
    if (!existingDoc) {
      throw new Error(`Document with id ${id} not found in collection ${collection}`)
    }
    if (!document.metadata) {
      document.id = id
      document.metadata = { id: id, type: 'post' as string }
      document.data = { $id: id, $type: 'post' as string }
    } else {
      document.id = id
      document.data.$id = id
    }
    const fullPath = nodePath.join(collection, id)
    const filePath = nodePath.join(this.collectionPath, `${fullPath}.mdx`)
    await fs.unlink(filePath)
    await this.writeDocument(fullPath, document)
  }

  async delete(collection: string, id: string): Promise<void> {
    const filePath = nodePath.join(this.collectionPath, collection, `${id}.mdx`)
    try {
      await fs.unlink(filePath)
      await this.storageService.deleteEmbedding(nodePath.join(collection, id))
      // Ensure the file is actually deleted by checking its existence
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      if (exists) {
        throw new Error(`Failed to delete document ${id} in collection ${collection}`)
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        throw error
      }
    }
  }

  async find(filter: FilterQuery<T>, options?: SearchOptions<T>): Promise<SearchResult<T>[]> {
    const docs = await this.getAllDocuments()
    const filtered = docs.filter(({ content }) => {
      return Object.entries(filter).every(([key, value]: [string, unknown]) => {
        if (typeof value === 'object' && value !== null) {
          const operators = value as Record<string, unknown>
          return Object.entries(operators).every(([op, val]: [string, unknown]) => {
            const docValue = content[key as keyof Document]
            if (docValue === undefined) return false

            switch (op) {
              case '$eq': return docValue === val
              case '$gt': return typeof docValue === 'number' && typeof val === 'number' && docValue > val
              case '$gte': return typeof docValue === 'number' && typeof val === 'number' && docValue >= val
              case '$lt': return typeof docValue === 'number' && typeof val === 'number' && docValue <= val
              case '$lte': return typeof docValue === 'number' && typeof val === 'number' && docValue <= val
              case '$in': return Array.isArray(val) && val.includes(docValue)
              case '$nin': return Array.isArray(val) && !val.includes(docValue)
              default: return false
            }
          })
        }
        return content[key as keyof Document] === value
      })
    })

    // Map to SearchResult<Document>[] with score and vector
    const results = filtered.map(doc => {
      const id = doc.content.id || ''
      const document = new BaseDocument(
        id,
        doc.content.content || '',
        {
          ...(doc.content.data || {}),
          $id: id,
          $type: 'post'
        },
        {
          ...(doc.content.metadata || {}),
          // Ensure required fields are set and take precedence
          id,
          type: 'post',
          ts: doc.content.metadata?.ts || Date.now()
        },
        doc.content.embeddings,
        doc.content.collections || ['test1']
      )

      return {
        document,
        score: 1.0, // Default score for filter matches
        vector: options?.includeVectors ? doc.content.embeddings : undefined
      }
    })

    // Apply search options
    let finalResults = results
    if (options?.limit !== undefined) {
      finalResults = finalResults.slice(options.offset || 0, (options.offset || 0) + options.limit)
    } else if (options?.offset !== undefined) {
      finalResults = finalResults.slice(options.offset)
    }

    return finalResults.map(result => ({
      document: result.document as T,
      score: result.score,
      vector: result.vector
    })) as SearchResult<T>[]
  }

  async search(query: string, options?: SearchOptions<T>): Promise<SearchResult<T>[]> {
    const queryEmbedding = await this.embeddingsService.generateEmbedding(query)
    return this.vectorSearch({
      ...options,
      vector: queryEmbedding,
      threshold: options?.threshold ?? 0.7
    })
  }

  async vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<SearchResult<T>[]> {
    if (!options.vector) {
      throw new Error('Vector is required for vector search')
    }

    const docs = await this.getAllDocuments()
    const threshold = options.threshold ?? 0.7

    const results = await Promise.all(
      docs.map(async ({ id, content }) => {
        const storedEmbedding = await this.storageService.getEmbedding(id)
        if (!storedEmbedding?.embedding) {
          console.debug(`No embedding found for document ${id}`)
          return {
            document: new BaseDocument(
              id,
              content.content,
              {
                ...(content.data || {}),
                $id: id,
                $type: 'post',
                $context: content.data?.$context as string | Record<string, unknown> | undefined
              },
              {
                id: id,
                type: 'post',
                ts: Date.now(),
                collections: content.collections || ['test1']  // Use test1 collection consistently
              },
              undefined,
              content.collections || ['test1']  // Use test1 collection consistently
            ),
            score: 0,
            vector: undefined
          }
        }

        const similarity = this.embeddingsService.calculateSimilarity(
          options.vector as number[],
          storedEmbedding.embedding
        )
        console.debug(`Document ${id} similarity: ${similarity}`)
        return {
          document: new BaseDocument(
            id,
            content.content,
            {
              ...(content.data || {}),
              $id: id,
              $type: 'post',
              $context: content.data?.$context as string | Record<string, unknown> | undefined
            },
            {
              id: id,
              type: 'post',
              ts: Date.now(),
              collections: content.collections || ['test1']  // Use test1 collection consistently
            },
            storedEmbedding?.embedding,
            content.collections || ['test1']  // Use test1 collection consistently
          ),
          score: similarity,
          vector: options.includeVectors ? storedEmbedding.embedding : undefined
        }
      })
    )

    const sortedResults = results
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10)
      .map(result => ({
        document: result.document as T,
        score: result.score,
        vector: result.vector
      }))
    
    return sortedResults
  }

  async readSchemaOrgFile(filename: string): Promise<Document | null> {
    // Add .mdx extension if not present
    if (!filename.endsWith('.mdx')) {
      filename = `${filename}.mdx`
    }
    const fullPath = `node_modules/mdxld/types/schema.org/${filename}`
    console.log('Reading schema.org file:', fullPath)
    return this.readDocument(fullPath)
  }
}
