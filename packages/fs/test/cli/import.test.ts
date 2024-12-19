import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { FSDatabase } from '../../src/index.js'
import { importCommand } from '../../src/cli/import.js'

describe('import command', () => {
  let tempDir: string
  let db: FSDatabase

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await mkdtemp(join(tmpdir(), 'mdxdb-test-'))
    db = new FSDatabase(tempDir)
    await db.connect()
  })

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('CSV import', () => {
    it('should import CSV file with basic fields', async () => {
      const csvContent = `title,description,author
Test Post,A test description,John Doe`
      const csvFile = join(tempDir, 'test.csv')
      await writeFile(csvFile, csvContent)

      await importCommand.parseAsync([
        'node', 'mdxdb', 'import',
        csvFile,
        '--collection', 'posts'
      ])

      const collection = db.collection('posts')
      const docs = await collection.list()
      expect(docs).toHaveLength(1)

      const doc = docs[0]
      expect(doc.data).toMatchObject({
        title: 'Test Post',
        description: 'A test description',
        author: 'John Doe'
      })
    })

    it('should handle YAML-LD fields with @ prefix', async () => {
      const csvContent = `@type,@context,title
BlogPosting,https://schema.org,Test Post`
      const csvFile = join(tempDir, 'test-ld.csv')
      await writeFile(csvFile, csvContent)

      await importCommand.parseAsync([
        'node', 'mdxdb', 'import',
        csvFile,
        '--collection', 'posts'
      ])

      const collection = db.collection('posts')
      const docs = await collection.list()
      expect(docs).toHaveLength(1)

      const doc = docs[0]
      expect(doc.data).toMatchObject({
        $type: 'BlogPosting',
        $context: 'https://schema.org',
        title: 'Test Post'
      })
    })
  })

  describe('JSONL import', () => {
    it('should import JSONL file with nested objects', async () => {
      const jsonlContent = `{"title":"Test Post","metadata":{"author":"John Doe","tags":["test","example"]}}\n{"title":"Another Post","metadata":{"author":"Jane Doe","tags":["sample"]}}`
      const jsonlFile = join(tempDir, 'test.jsonl')
      await writeFile(jsonlFile, jsonlContent)

      await importCommand.parseAsync([
        'node', 'mdxdb', 'import',
        jsonlFile,
        '--collection', 'posts'
      ])

      const collection = db.collection('posts')
      const docs = await collection.list()
      expect(docs).toHaveLength(2)

      expect(docs[0].data).toMatchObject({
        title: 'Test Post',
        metadata: {
          author: 'John Doe',
          tags: ['test', 'example']
        }
      })
    })
  })

  describe('template and field mapping', () => {
    it('should use template file for content', async () => {
      const csvContent = 'title,author\nTest Post,John Doe'
      const templateContent = '# {title}\n\nWritten by {author}'

      const csvFile = join(tempDir, 'test.csv')
      const templateFile = join(tempDir, 'template.mdx')

      await writeFile(csvFile, csvContent)
      await writeFile(templateFile, templateContent)

      await importCommand.parseAsync([
        'node', 'mdxdb', 'import',
        csvFile,
        '--collection', 'posts',
        '--template', templateFile
      ])

      const collection = db.collection('posts')
      const docs = await collection.list()
      expect(docs).toHaveLength(1)
      expect(docs[0].content).toContain('# Test Post')
      expect(docs[0].content).toContain('Written by John Doe')
    })

    it('should respect field mapping options', async () => {
      const csvContent = 'postTitle,postContent,authorName\nTest Post,Hello World,John Doe'
      const csvFile = join(tempDir, 'test.csv')
      await writeFile(csvFile, csvContent)

      await importCommand.parseAsync([
        'node', 'mdxdb', 'import',
        csvFile,
        '--collection', 'posts',
        '--id-field', 'postTitle',
        '--content-field', 'postContent',
        '--frontmatter-fields', 'authorName'
      ])

      const collection = db.collection('posts')
      const docs = await collection.list()
      expect(docs).toHaveLength(1)
      expect(docs[0].id).toBe('Test Post')
      expect(docs[0].content).toContain('Hello World')
      expect(docs[0].data).toMatchObject({
        authorName: 'John Doe'
      })
    })
  })

  describe('complex value types', () => {
    it('should handle numeric and array values in JSONL', async () => {
      const jsonlContent = `{
        "title": "Test Post",
        "views": 1234,
        "rating": 4.5,
        "tags": ["test", "example"],
        "metadata": {
          "published": true,
          "categories": ["tech", "tutorial"],
          "stats": {
            "wordCount": 500,
            "readingTime": 3.5
          }
        }
      }`
      const jsonlFile = join(tempDir, 'test.jsonl')
      await writeFile(jsonlFile, jsonlContent)

      await importCommand.parseAsync([
        'node', 'mdxdb', 'import',
        jsonlFile,
        '--collection', 'posts'
      ])

      const collection = db.collection('posts')
      const docs = await collection.list()
      expect(docs).toHaveLength(1)
      expect(docs[0].data).toMatchObject({
        title: 'Test Post',
        views: 1234,
        rating: 4.5,
        tags: ['test', 'example'],
        metadata: {
          published: true,
          categories: ['tech', 'tutorial'],
          stats: {
            wordCount: 500,
            readingTime: 3.5
          }
        }
      })
    })

    it('should handle complex YAML-LD fields with mixed types', async () => {
      const csvContent = `@type,@context,title,@graph
BlogPosting,https://schema.org,Test Post,"[{\\"@type\\":\\"Person\\",\\"name\\":\\"John Doe\\",\\"age\\":30},{\\"@type\\":\\"Organization\\",\\"name\\":\\"Test Corp\\",\\"employees\\":100}]"`
      const csvFile = join(tempDir, 'test-ld.csv')
      await writeFile(csvFile, csvContent)

      await importCommand.parseAsync([
        'node', 'mdxdb', 'import',
        csvFile,
        '--collection', 'posts'
      ])

      const collection = db.collection('posts')
      const docs = await collection.list()
      expect(docs).toHaveLength(1)
      expect(docs[0].data).toMatchObject({
        $type: 'BlogPosting',
        $context: 'https://schema.org',
        title: 'Test Post',
        $graph: [
          {
            $type: 'Person',
            name: 'John Doe',
            age: 30
          },
          {
            $type: 'Organization',
            name: 'Test Corp',
            employees: 100
          }
        ]
      })
    })
  })

  describe('error handling', () => {
    it('should handle invalid CSV format', async () => {
      const csvContent = `title,description\nTest Post,Description,Extra`
      const csvFile = join(tempDir, 'invalid.csv')
      await writeFile(csvFile, csvContent)

      await expect(importCommand.parseAsync([
        'node', 'mdxdb', 'import',
        csvFile,
        '--collection', 'posts'
      ])).rejects.toThrow()
    })

    it('should handle invalid JSONL format', async () => {
      const jsonlContent = `{"title":"Test Post"}\n{"title":Invalid JSON}`
      const jsonlFile = join(tempDir, 'invalid.jsonl')
      await writeFile(jsonlFile, jsonlContent)

      await expect(importCommand.parseAsync([
        'node', 'mdxdb', 'import',
        jsonlFile,
        '--collection', 'posts'
      ])).rejects.toThrow()
    })
  })
})
