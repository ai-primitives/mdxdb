import { z } from 'zod';

/**
 * Schema for ClickHouse configuration
 * Validates and provides defaults for all required configuration options
 */
export const configSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().default(8123),
  username: z.string().default('default'),
  password: z.string().default(''),
  database: z.string().default('default'),
  oplogTable: z.string().default('oplog'),
  dataTable: z.string().default('data'),
  clickhouse_settings: z.object({
    allow_experimental_json_type: z.number().default(1),
    allow_experimental_full_text_index: z.number().default(1),
    allow_experimental_vector_similarity_index: z.number().default(1)
  }).optional()
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
    host: process.env.CLICKHOUSE_HOST || process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USERNAME,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DATABASE,
    oplogTable: process.env.CLICKHOUSE_OPLOG_TABLE || 'oplog',
    dataTable: process.env.CLICKHOUSE_DATA_TABLE || 'data',
    clickhouse_settings: {
      allow_experimental_json_type: 1,
      allow_experimental_full_text_index: 1,
      allow_experimental_vector_similarity_index: 1
    }
  });
};
