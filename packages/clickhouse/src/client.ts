import { createClient, type ClickHouseClient } from '@clickhouse/client-web';
import type { Config } from './config';
import { checkClickHouseVersion } from './utils';

export const createClickHouseClient = async (config: Config): Promise<ClickHouseClient> => {
  try {
    const client = createClient({
      host: config.url,
      username: config.username,
      password: config.password,
      database: config.database
    });

    await checkClickHouseVersion(client);
    return client;
  } catch (error) {
    const enhancedError = error instanceof Error
      ? new Error(`Failed to create ClickHouse client: ${error.message}`)
      : new Error('Failed to create ClickHouse client: Unknown error');

    throw enhancedError;
  }
};
