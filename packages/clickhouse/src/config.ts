import { z } from 'zod';

/**
 * Schema for ClickHouse configuration
 * Validates and provides defaults for all required configuration options
 */
export const configSchema = z.object({
  url: z.string().default('http://localhost:8123'),
  username: z.string().default('default'),
  password: z.string().default(''),
  database: z.string().default('default'),
  oplogTable: z.string().default('opLog'),
  dataTable: z.string().default('dataTable')
});

/**
 * Type definition for ClickHouse configuration
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Gets configuration from environment variables with defaults
 * @returns Validated configuration object
 */
export const getConfig = (): Config => {
  return configSchema.parse({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USERNAME,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DATABASE,
    oplogTable: process.env.CLICKHOUSE_OPLOG_TABLE || 'opLog',
    dataTable: process.env.CLICKHOUSE_DATA_TABLE || 'dataTable'
  });
};
