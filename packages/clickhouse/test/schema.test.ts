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
      expect(schema).toContain('metadata JSON')
      expect(schema).toContain('type String')
      expect(schema).toContain('ns String')
      expect(schema).toContain('host String')
      expect(schema).toContain('path Array(String)')
      expect(schema).toContain('data JSON')
      expect(schema).toContain('content String')
      expect(schema).toContain('embedding Array(Float32)')
      expect(schema).toContain('ts UInt32')
      expect(schema).toContain('hash JSON')
      expect(schema).toContain('version UInt64')
      expect(schema).toContain('INDEX idx_content content TYPE full_text GRANULARITY 1')
      expect(schema).toContain('INDEX idx_embedding embedding TYPE vector_similarity(\'hnsw\', \'cosineDistance\')')
      expect(schema).toContain('ORDER BY (id, version)')
    })

    it('should generate valid data table schema', () => {
      const schema = getTablesSchema(dbName)
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${dbName}.data`)
      expect(schema).toContain('ENGINE = VersionedCollapsingMergeTree(sign, version)')
      expect(schema).toContain('id String')
      expect(schema).toContain('metadata JSON')
      expect(schema).toContain('type String')
      expect(schema).toContain('ns String')
      expect(schema).toContain('host String')
      expect(schema).toContain('path Array(String)')
      expect(schema).toContain('data JSON')
      expect(schema).toContain('content String')
      expect(schema).toContain('embedding Array(Float32)')
      expect(schema).toContain('ts UInt32')
      expect(schema).toContain('hash JSON')
      expect(schema).toContain('version UInt64')
      expect(schema).toContain('sign Int8')
      expect(schema).toContain('INDEX idx_content content TYPE full_text GRANULARITY 1')
      expect(schema).toContain('INDEX idx_embedding embedding TYPE vector_similarity(\'hnsw\', \'cosineDistance\')')
      expect(schema).toContain('ORDER BY (id, version)')
    })
  })

  describe('Materialized View Schema', () => {
    it('should generate valid materialized view schema', () => {
      const schema = getMaterializedViewSchema(dbName)
      expect(schema).toContain(`CREATE MATERIALIZED VIEW IF NOT EXISTS ${dbName}.dataMv`)
      expect(schema).toContain(`TO ${dbName}.data`)
      expect(schema).toContain('AS SELECT')
      expect(schema).toContain('id')
      expect(schema).toContain('metadata')
      expect(schema).toContain('type')
      expect(schema).toContain('ns')
      expect(schema).toContain('host')
      expect(schema).toContain('path')
      expect(schema).toContain('data')
      expect(schema).toContain('content')
      expect(schema).toContain('embedding')
      expect(schema).toContain('ts')
      expect(schema).toContain('hash')
      expect(schema).toContain('version')
      expect(schema).toContain(`FROM ${dbName}.oplog`)
      expect(schema).toContain('CAST(1 AS Int8) as sign')
    })
  })
})
