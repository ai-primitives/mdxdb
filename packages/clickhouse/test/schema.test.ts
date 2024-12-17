import { describe, it, expect } from 'vitest'
import {
  getDatabaseSchema,
  getTablesSchema,
  getMaterializedViewSchema
} from '../src/schema'

describe('ClickHouse Schema', () => {
  const dbName = 'mdxdb_test'

  describe('Database Schema', () => {
    it('should generate valid database creation SQL', () => {
      const schema = getDatabaseSchema(dbName)
      expect(schema).toContain('CREATE DATABASE IF NOT EXISTS')
      expect(schema).toContain(dbName)
    })
  })

  describe('Tables Schema', () => {
    it('should generate valid oplog table schema', () => {
      const schema = getTablesSchema(dbName)
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${dbName}.oplog`)
      expect(schema).toContain('ENGINE = MergeTree')
      expect(schema).toContain('id String')
      expect(schema).toContain('ts UInt32')
      expect(schema).toContain('ns String')
      expect(schema).toContain('hash JSON')
      expect(schema).toContain('version UInt64')
    })

    it('should generate valid data table schema', () => {
      const schema = getTablesSchema(dbName)
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${dbName}.data`)
      expect(schema).toContain('ENGINE = VersionedCollapsingMergeTree')
      expect(schema).toContain('id String')
      expect(schema).toContain('ts UInt32')
      expect(schema).toContain('ns String')
      expect(schema).toContain('hash JSON')
      expect(schema).toContain('version UInt64')
    })
  })

  describe('Materialized View Schema', () => {
    it('should generate valid materialized view schema', () => {
      const schema = getMaterializedViewSchema(dbName)
      expect(schema).toContain(`CREATE MATERIALIZED VIEW IF NOT EXISTS ${dbName}.dataMv`)
      expect(schema).toContain(`TO ${dbName}.data`)
      expect(schema).toContain('AS SELECT')
      expect(schema).toContain(`FROM ${dbName}.oplog`)
      expect(schema).toContain('1 as sign')
    })
  })
})
