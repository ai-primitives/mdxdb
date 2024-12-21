import * as vscode from 'vscode'
import type { DatabaseProvider, Document } from '@mdxdb/types'

async function loadProviders() {
  const { FSDatabase } = await import('@mdxdb/fs')
  const { FetchProvider } = await import('@mdxdb/fetch')
  const { createClickHouseClient } = await import('@mdxdb/clickhouse')
  return { FSDatabase, FetchProvider, createClickHouseClient }
}

/**
 * Creates a database provider based on VSCode workspace configuration
 * @returns DatabaseProvider instance (fs, fetch, or clickhouse)
 */
export async function createProvider(): Promise<DatabaseProvider<Document>> {
  const config = vscode.workspace.getConfiguration('mdxdb')
  const useProvider = config.get<string>('provider') ?? 'fs'

  // Get OPENAI_API_KEY from environment if available
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for embeddings')
  }

  const { FSDatabase, FetchProvider, createClickHouseClient } = await loadProviders()

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
  
  // Add openaiApiKey to collection creation
  const originalCollection = db.collection.bind(db)
  db.collection = (name: string) => {
    return originalCollection(name)
  }

  return db
}
