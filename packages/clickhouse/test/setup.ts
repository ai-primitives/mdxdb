import { afterAll, beforeAll } from 'vitest'
import { createClient } from '@clickhouse/client-web'
import { dockerTestConfig } from './docker.config'

beforeAll(async () => {
  const client = createClient({
    url: `${dockerTestConfig.protocol}://${dockerTestConfig.host}:${dockerTestConfig.port}`,
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
          sign Int8
        ) ENGINE = VersionedCollapsingMergeTree(sign, version)
        ORDER BY (JSONExtractString(metadata, 'id'), version)
        AS SELECT
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
    url: `${dockerTestConfig.protocol}://${dockerTestConfig.host}:${dockerTestConfig.port}`,
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
