import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export interface StoredEmbedding {
  id: string
  content: string
  embedding: number[]
  timestamp: number
}

export interface EmbeddingsStorage {
  version: '1'
  embeddings: Record<string, StoredEmbedding>
}

export class EmbeddingsStorageService {
  private dbPath: string
  private storageFile: string

  constructor(basePath: string) {
    this.dbPath = join(basePath, '.db')
    this.storageFile = join(this.dbPath, 'embeddings.json')
  }

  private async ensureDbDirectory(): Promise<void> {
    try {
      await mkdir(this.dbPath, { recursive: true })
    } catch (error) {
      if ((error as { code?: string }).code !== 'EEXIST') {
        throw new Error(`Failed to create .db directory: ${error}`)
      }
    }
  }

  private async readStorage(): Promise<EmbeddingsStorage> {
    try {
      const content = await readFile(this.storageFile, 'utf-8')
      return JSON.parse(content) as EmbeddingsStorage
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        // File doesn't exist, return empty storage
        return {
          version: '1',
          embeddings: {}
        }
      }
      throw new Error(`Failed to read embeddings storage: ${error}`)
    }
  }

  private async writeStorage(storage: EmbeddingsStorage): Promise<void> {
    await this.ensureDbDirectory()
    await writeFile(this.storageFile, JSON.stringify(storage, null, 2), 'utf-8')
  }

  async storeEmbedding(id: string, content: string, embedding: number[]): Promise<void> {
    const storage = await this.readStorage()
    storage.embeddings[id] = {
      id,
      content,
      embedding,
      timestamp: Date.now()
    }
    await this.writeStorage(storage)
  }

  async getEmbedding(id: string): Promise<StoredEmbedding | null> {
    const storage = await this.readStorage()
    return storage.embeddings[id] || null
  }

  async getAllEmbeddings(): Promise<StoredEmbedding[]> {
    const storage = await this.readStorage()
    return Object.values(storage.embeddings)
  }

  async deleteEmbedding(id: string): Promise<void> {
    const storage = await this.readStorage()
    delete storage.embeddings[id]
    await this.writeStorage(storage)
  }
}
