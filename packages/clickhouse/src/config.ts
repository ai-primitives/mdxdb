import { z } from 'zod';

export const vectorIndexConfigSchema = z.object({
  type: z.literal('hnsw'),
  metric: z.literal('cosineDistance'),
  dimensions: z.number().int().positive()
});

export type VectorIndexConfig = z.infer<typeof vectorIndexConfigSchema>;

export const configSchema = z.object({
  url: z.string().default('http://localhost:8123'),
  username: z.string().default('default'),
  password: z.string().default(''),
  database: z.string().default('default'),
  oplogTable: z.string().default('oplog'),
  dataTable: z.string().default('data'),
  vectorIndexConfig: vectorIndexConfigSchema.optional()
});

export type Config = z.infer<typeof configSchema>;

export const getConfig = (): Config => {
  return configSchema.parse({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USERNAME,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DATABASE,
    oplogTable: process.env.CLICKHOUSE_OPLOG_TABLE,
    dataTable: process.env.CLICKHOUSE_DATA_TABLE,
    vectorIndexConfig: process.env.CLICKHOUSE_VECTOR_CONFIG ?
      JSON.parse(process.env.CLICKHOUSE_VECTOR_CONFIG) :
      undefined
  });
};
