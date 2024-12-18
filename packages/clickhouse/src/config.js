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
    oplogTable: z.string().default('oplog'),
    dataTable: z.string().default('data')
});
/**
 * Gets configuration from environment variables with defaults
 * @returns Validated configuration object
 */
export const getConfig = () => {
    return configSchema.parse({
        url: process.env.CLICKHOUSE_URL,
        username: process.env.CLICKHOUSE_USERNAME,
        password: process.env.CLICKHOUSE_PASSWORD,
        database: process.env.CLICKHOUSE_DATABASE,
        oplogTable: process.env.CLICKHOUSE_OPLOG_TABLE,
        dataTable: process.env.CLICKHOUSE_DATA_TABLE
    });
};
