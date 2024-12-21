import * as vscode from 'vscode'
import { FSDatabase } from '@mdxdb/fs'
import { FSCollection } from '@mdxdb/fs/src/collection'
import { FetchProvider } from '@mdxdb/fetch'
import { createClickHouseClient } from '@mdxdb/clickhouse/src/client'
import type { DatabaseProvider } from '@mdxdb/types'

/**
 * Creates a database provider based on VSCode workspace configuration
 * @returns DatabaseProvider instance (fs, fetch, or clickhouse)
 */
export function createProvider(): DatabaseProvider {
  const config = vscode.workspace.getConfiguration('mdxdb')
  const useProvider = config.get<string>('provider') ?? 'fs'

  // Get OPENAI_API_KEY from environment if available
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for embeddings')
  }

  if (useProvider === 'fetch') {
    const endpoint = config.get<string>('fetch.endpoint') ?? ''
    const token = config.get<string>('fetch.token') ?? ''
    
    if (!endpoint) {
      throw new Error('Fetch provider requires endpoint configuration')
    }

    return new FetchProvider({ 
      namespace: 'mdx', 
      baseUrl: endpoint, 
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      openaiApiKey
    })
  } 
  
  if (useProvider === 'clickhouse') {
    const url = config.get<string>('clickhouse.url') ?? 'http://localhost:8123'
    const database = config.get<string>('clickhouse.database') ?? 'mdxdb'
    const username = config.get<string>('clickhouse.username') ?? 'default'
    const password = config.get<string>('clickhouse.password') ?? ''
    const oplogTable = config.get<string>('clickhouse.oplogTable') ?? 'oplog'
    const dataTable = config.get<string>('clickhouse.dataTable') ?? 'data'

    if (!url || !database) {
      throw new Error('ClickHouse provider requires url and database configuration')
    }

    return createClickHouseClient({ 
      url, 
      username, 
      password, 
      database,
      oplogTable,
      dataTable,
      openaiApiKey
    })
  }

  // Default to fs provider
  const fsPath = config.get<string>('fs.path') ?? '.'
  const db = new FSDatabase(fsPath)
  
  // Override the collection method to include openaiApiKey in options
  const originalCollection = db.collection.bind(db)
  db.collection = (name: string) => {
    const collection = originalCollection(name) as FSCollection
    return new FSCollection(fsPath, name, { openaiApiKey })
  }

  return db
}
