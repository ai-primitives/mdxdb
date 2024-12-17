import { ClickHouseClient } from '@clickhouse/client'

export interface MDXDBClickHouseClient {
  // Basic client interface to be expanded
  client: ClickHouseClient
}

export const createClient = (): MDXDBClickHouseClient => {
  return {
    client: {} as ClickHouseClient // Temporary implementation for test
  }
}
