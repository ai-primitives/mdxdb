import { afterAll, beforeAll } from 'vitest'
import { createClient } from '@clickhouse/client-web'
import { dockerTestConfig } from './docker.config.js'

beforeAll(async () => {
  const client = createClient({
    url: `http://${dockerTestConfig.host}:${dockerTestConfig.port}`,
    username: dockerTestConfig.username,
    password: dockerTestConfig.password,
    clickhouse_settings: {
      allow_experimental_json_type: 1,
      allow_experimental_full_text_index: 1,
      allow_experimental_vector_similarity_index: 1
    }
  })

  try {
    // Create database
    await client.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${dockerTestConfig.database}`
    })

    // Use database
    await client.exec({
      query: `USE ${dockerTestConfig.database}`
    })

    // Create tables
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ${dockerTestConfig.database}.${dockerTestConfig.oplogTable} (
          metadata JSON,
          type String,
          ns String,
          host String,
          path Array(String),
          data JSON,
          content String,
          embedding Array(Float32),
          ts UInt32,
          hash JSON,
          version UInt64
        ) ENGINE = MergeTree()
        ORDER BY (JSONExtractString(metadata, 'id'), version)
      `
    })

    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ${dockerTestConfig.database}.${dockerTestConfig.dataTable} (
          id String,
          metadata JSON,
          type String,
          ns String,
          host String,
          path Array(String),
          data JSON,
          content String,
          embedding Array(Float32),
          ts UInt32,
          hash JSON,
          version UInt64,
          sign Int8,
          INDEX idx_content content TYPE full_text GRANULARITY 1,
          INDEX idx_embedding embedding TYPE vector_similarity('hnsw', 'cosineDistance')
        ) ENGINE = VersionedCollapsingMergeTree(sign, version)
        ORDER BY (id, version)
        AS SELECT
          JSONExtractString(metadata, 'id') as id,
          metadata,
          type,
          ns,
          host,
          path,
          data,
          content,
          embedding,
          ts,
          hash,
          version,
          CAST(1 AS Int8) as sign
        FROM ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
      `
    })
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  } finally {
    await client.close()
  }
})

afterAll(async () => {
  const client = createClient({
    url: `http://${dockerTestConfig.host}:${dockerTestConfig.port}`,
    username: dockerTestConfig.username,
    password: dockerTestConfig.password
  })

  try {
    await client.exec({
      query: `DROP DATABASE IF EXISTS ${dockerTestConfig.database}`
    })
  } catch (error) {
    console.error('Failed to drop database:', error)
  } finally {
    await client.close()
  }
})
