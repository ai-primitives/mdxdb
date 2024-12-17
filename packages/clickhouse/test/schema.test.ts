import { describe, it, expect } from 'vitest'
import { getDatabaseSchema, getTablesSchema, getMaterializedViewSchema } from '../src/schema'

describe('ClickHouse Schema', () => {
  it('should generate database schema', () => {
    const schema = getDatabaseSchema('test_db')
    expect(schema).toBeDefined()
    expect(schema).toContain('CREATE DATABASE IF NOT EXISTS test_db')
  })

  it('should generate tables schema', () => {
    const schema = getTablesSchema('test_db')
    expect(schema).toBeDefined()
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS test_db.oplog')
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS test_db.data')
  })

  it('should generate materialized view schema', () => {
    const schema = getMaterializedViewSchema('test_db')
    expect(schema).toBeDefined()
    expect(schema).toContain('CREATE MATERIALIZED VIEW IF NOT EXISTS test_db.dataMv')
    expect(schema).toContain('TO test_db.data')
  })
})
