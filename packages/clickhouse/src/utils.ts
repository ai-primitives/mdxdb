import type { ClickHouseClient } from '@clickhouse/client';

/**
 * Checks if the connected ClickHouse instance meets the minimum version requirements
 * @param client ClickHouse client instance
 * @throws Error if version requirements are not met
 */
export const checkClickHouseVersion = async (client: ClickHouseClient): Promise<void> => {
  const result = await client.query({
    query: 'SELECT version()'
  }).then(res => res.json()) as Array<{ version: string }>;

  const [{ version }] = result;
  const [major, minor] = version.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 10)) {
    throw new Error('ClickHouse v24.10+ is required for JSON field support');
  }
};
