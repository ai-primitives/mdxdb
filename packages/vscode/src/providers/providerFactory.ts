import * as vscode from 'vscode'
import type { DatabaseProvider, Document } from '@mdxdb/types'
import { FSDatabase } from '@mdxdb/fs'

/**
 * Creates a database provider based on VSCode workspace configuration
 * @returns DatabaseProvider instance (fs, fetch, or clickhouse)
 */
export async function createProvider(): Promise<DatabaseProvider<Document>> {
  const config = vscode.workspace.getConfiguration('mdxdb')
  const useProvider = config.get<string>('provider') ?? 'fs'

  if (useProvider === 'fetch') {
    try {
      const endpoint = config.get<string>('fetch.endpoint') ?? ''
      const token = config.get<string>('fetch.token') ?? ''
      
      if (!endpoint) {
        throw new Error('Fetch provider requires endpoint configuration')
      }

      const { FetchProvider } = await import('@mdxdb/fetch')
      return new FetchProvider({ 
        namespace: 'mdx', 
        baseUrl: endpoint, 
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
    } catch (error) {
      console.warn('Failed to load fetch provider:', error)
      // Fall back to fs provider
      const fsPath = config.get<string>('fs.path') ?? '.'
      return new FSDatabase(fsPath)
    }
  } 
  
  if (useProvider === 'clickhouse') {
    try {
      const url = config.get<string>('clickhouse.url') ?? 'http://localhost:8123'
      const database = config.get<string>('clickhouse.database') ?? 'mdxdb'
      const username = config.get<string>('clickhouse.username') ?? 'default'
      const password = config.get<string>('clickhouse.password') ?? ''
      const oplogTable = config.get<string>('clickhouse.oplogTable') ?? 'oplog'
      const dataTable = config.get<string>('clickhouse.dataTable') ?? 'data'

      if (!url || !database) {
        throw new Error('ClickHouse provider requires url and database configuration')
      }

      const { createClickHouseClient } = await import('@mdxdb/clickhouse')
      return createClickHouseClient({ 
        url, 
        username, 
        password, 
        database,
        oplogTable,
        dataTable
      })
    } catch (error) {
      console.warn('Failed to load clickhouse provider:', error)
      // Fall back to fs provider
      const fsPath = config.get<string>('fs.path') ?? '.'
      return new FSDatabase(fsPath)
    }
  }

  // Default to fs provider
  const fsPath = config.get<string>('fs.path') ?? '.'
  return new FSDatabase(fsPath)
}
