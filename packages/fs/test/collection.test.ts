import { expect, test, beforeEach, afterEach } from 'vitest'
import { FSCollection } from '../src/collection'
import { CollectionProvider, Document } from '@mdxdb/types'
import * as fs from 'fs/promises'
import * as path from 'path'

const TEST_DIR = path.join(__dirname, '.test-collection')

beforeEach(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true })
})

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true })
})

test('FSCollection implements CollectionProvider interface', () => {
  const collection = new FSCollection(TEST_DIR, 'test')
  expect(collection).toBeDefined()
  expect(collection.path).toBe('test')
  expect(typeof collection.find).toBe('function')
  expect(typeof collection.search).toBe('function')
  expect(typeof collection.vectorSearch).toBe('function')
})

test('find returns empty array for placeholder implementation', async () => {
  const collection = new FSCollection(TEST_DIR, 'test')
  const results = await collection.find({})
  expect(Array.isArray(results)).toBe(true)
  expect(results).toHaveLength(0)
})

test('search returns empty array for placeholder implementation', async () => {
  const collection = new FSCollection(TEST_DIR, 'test')
  const results = await collection.search('query')
  expect(Array.isArray(results)).toBe(true)
  expect(results).toHaveLength(0)
})

test('vectorSearch returns empty array for placeholder implementation', async () => {
  const collection = new FSCollection(TEST_DIR, 'test')
  const results = await collection.vectorSearch({ vector: [0.1, 0.2] })
  expect(Array.isArray(results)).toBe(true)
  expect(results).toHaveLength(0)
})
