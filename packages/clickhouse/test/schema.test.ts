import { describe, it, expect } from 'vitest'
import { getDatabaseSchema, getTablesSchema, getMaterializedViewSchema } from '../src/schema'

describe('ClickHouse Schema', () => {
  const dbName = 'mdxdb'

  it('should generate valid database creation SQL', () => {
    const sql = getDatabaseSchema(dbName)
    expect(sql).toContain('CREATE DATABASE IF NOT EXISTS')
    expect(sql).toContain(dbName)
  })

  it('should generate valid tables SQL', () => {
    const sql = getTablesSchema(dbName)
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${dbName}.oplog`)
    expect(sql).toContain('MergeTree')
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${dbName}.data`)
    expect(sql).toContain('VersionedCollapsingMergeTree')
    expect(sql).toContain('hash JSON')
    expect(sql).toContain('version UInt64')
  })

  it('should generate valid materialized view SQL', () => {
    const sql = getMaterializedViewSchema(dbName)
    expect(sql).toContain(`CREATE MATERIALIZED VIEW IF NOT EXISTS ${dbName}.dataMv`)
    expect(sql).toContain('1 as sign')
  })
})
