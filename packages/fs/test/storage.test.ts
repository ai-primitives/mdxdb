import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { EmbeddingsStorageService } from '../src/storage'

describe('EmbeddingsStorageService', () => {
  let testDir: string
  let storageService: EmbeddingsStorageService

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-embeddings-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
    storageService = new EmbeddingsStorageService(testDir)
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should create storage file when storing first embedding', async () => {
    const id = 'test1'
    const content = 'test content'
    const embedding = [0.1, 0.2, 0.3]

    await storageService.storeEmbedding(id, content, embedding)

    const storagePath = join(testDir, '.db', 'embeddings.json')
    const fileContent = await readFile(storagePath, 'utf-8')
    const storage = JSON.parse(fileContent)

    expect(storage.version).toBe('1')
    expect(storage.embeddings[id]).toEqual({
      id,
      content,
      embedding,
      timestamp: expect.any(Number)
    })
  })

  it('should retrieve stored embedding', async () => {
    const id = 'test2'
    const content = 'test content'
    const embedding = [0.1, 0.2, 0.3]

    await storageService.storeEmbedding(id, content, embedding)
    const retrieved = await storageService.getEmbedding(id)

    expect(retrieved).toEqual({
      id,
      content,
      embedding,
      timestamp: expect.any(Number)
    })
  })

  it('should return null for non-existent embedding', async () => {
    const retrieved = await storageService.getEmbedding('non-existent')
    expect(retrieved).toBeNull()
  })

  it('should get all embeddings', async () => {
    const embeddings = [
      { id: 'test1', content: 'content1', embedding: [0.1] },
      { id: 'test2', content: 'content2', embedding: [0.2] }
    ]

    for (const { id, content, embedding } of embeddings) {
      await storageService.storeEmbedding(id, content, embedding)
    }

    const allEmbeddings = await storageService.getAllEmbeddings()
    expect(allEmbeddings).toHaveLength(2)
    expect(allEmbeddings.map(e => e.id)).toEqual(['test1', 'test2'])
  })

  it('should delete embedding', async () => {
    const id = 'test3'
    await storageService.storeEmbedding(id, 'content', [0.1])
    await storageService.deleteEmbedding(id)

    const retrieved = await storageService.getEmbedding(id)
    expect(retrieved).toBeNull()
  })
})
