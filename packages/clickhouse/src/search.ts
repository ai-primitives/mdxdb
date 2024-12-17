import type { ClickHouseClient } from '@clickhouse/client-web';
import type { Config } from './config';

/**
 * Search for similar documents using vector similarity
 * @param client ClickHouse client instance
 * @param config ClickHouse configuration
 * @param embedding 256-dimensional vector from text-embedding-3-large model
 * @param options Search options (threshold and limit)
 * @returns Array of similar documents with distance scores
 */
export const searchSimilar = async (
  client: ClickHouseClient,
  config: Config,
  embedding: number[],
  { limit = 10, threshold = 0.8 } = {}
) => {
  if (embedding.length !== 256) {
    throw new Error('Embedding must be a 256-dimensional vector from text-embedding-3-large model');
  }

  const result = await client.query({
    query: `
      SELECT *,
        cosineDistance(embedding, {embedding:Array(Float32)}) as distance
      FROM ${config.database}.${config.dataTable}
      WHERE sign = 1
      HAVING distance <= (1 - ${threshold})
      ORDER BY distance ASC
      LIMIT ${limit}
    `,
    query_params: {
      embedding
    }
  });

  return result.json();
};
