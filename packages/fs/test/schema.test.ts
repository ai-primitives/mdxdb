import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FSCollection } from '../src/collection'
import * as path from 'path'
import { promises as fs } from 'fs'

const TEST_DIR = path.join(__dirname, '.test-schema')

describe('FSCollection - schema.org MDX files', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  })

  it('should read MDX files from node_modules/mdxld/types/schema.org', async () => {
    const collection = new FSCollection(TEST_DIR, 'test')
    const doc = await collection.readSchemaOrgFile('Article.mdx')

    expect(doc).not.toBeNull()
    expect(doc?.content).toContain('$context: schema.org')
    expect(doc?.content).toContain('$type: Article')
  })

  it('should handle multiple schema.org MDX files', async () => {
    const collection = new FSCollection(TEST_DIR, 'test')
    const files = ['Article.mdx', 'Person.mdx', 'Organization.mdx']

    for (const file of files) {
      const doc = await collection.readSchemaOrgFile(file)
      expect(doc).not.toBeNull()
      expect(doc?.content).toContain('$context: schema.org')
    }
  })

  it('should handle non-existent schema.org MDX files gracefully', async () => {
    const collection = new FSCollection(TEST_DIR, 'test')
    const doc = await collection.readSchemaOrgFile('NonExistent.mdx')
    expect(doc).toBeNull()
  })
})
