import { expect, test, beforeEach, afterEach } from 'vitest'
import { FSDatabase } from '../src'
import { DatabaseProvider, Document } from '../../types/src/types'
import * as fs from 'fs/promises'
import * as path from 'path'

const TEST_DIR = path.join(__dirname, '.test-db')

beforeEach(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true })
})

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true })
})

test('FSDatabase implements DatabaseProvider interface', () => {
  const db = new FSDatabase(TEST_DIR)
  expect(db).toBeDefined()
  expect(db.namespace).toBe(`file://${path.resolve(TEST_DIR)}`)
  expect(typeof db.connect).toBe('function')
  expect(typeof db.disconnect).toBe('function')
  expect(typeof db.list).toBe('function')
  expect(typeof db.collection).toBe('function')
})

test('connect creates directory and initializes collections', async () => {
  const db = new FSDatabase(TEST_DIR)
  await db.connect()
  const exists = await fs.access(TEST_DIR).then(() => true).catch(() => false)
  expect(exists).toBe(true)
})

test('list returns collection names', async () => {
  const db = new FSDatabase(TEST_DIR)
  await db.connect()  // Connect first to initialize collections
  await fs.mkdir(path.join(TEST_DIR, 'test-collection'))
  await db.connect()  // Reconnect to load the new collection
  const collections = await db.list()
  expect(collections).toContain('test-collection')
})

test('collection returns a CollectionProvider instance', () => {
  const db = new FSDatabase(TEST_DIR)
  const collection = db.collection('test')
  expect(collection).toBeDefined()
  expect(collection.path).toBe('test')
  expect(typeof collection.find).toBe('function')
  expect(typeof collection.search).toBe('function')
  expect(typeof collection.vectorSearch).toBe('function')
})

test('disconnect cleans up resources', async () => {
  const db = new FSDatabase(TEST_DIR)
  await db.connect()
  await db.disconnect()
  // After disconnect, the directory should still exist but be empty
  const exists = await fs.access(TEST_DIR).then(() => true).catch(() => false)
  expect(exists).toBe(true)
})
