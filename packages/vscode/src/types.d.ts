declare module '@mdxdb/fetch' {
  import type { DatabaseProvider, Document, CollectionProvider } from '@mdxdb/types'

  export interface FetchProviderConfig {
    namespace?: string
    baseUrl: string
    headers?: Record<string, string>
  }

  export class FetchProvider implements DatabaseProvider<Document> {
    constructor(config: FetchProviderConfig)
    namespace: string
    collections: CollectionProvider<Document>
    connect(): Promise<void>
    disconnect(): Promise<void>
    list(): Promise<string[]>
    collection(name: string): CollectionProvider<Document>
  }
}

declare module '@mdxdb/clickhouse' {
  import type { DatabaseProvider, Document } from '@mdxdb/types'

  export interface ClickHouseConfig {
    url: string
    username?: string
    password?: string
    database: string
    oplogTable?: string
    dataTable?: string
  }

  export function createClickHouseClient(config: ClickHouseConfig): Promise<DatabaseProvider<Document>>
}
