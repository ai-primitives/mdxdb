import type { ClickHouseClient } from '@clickhouse/client-web';
import type { Config } from './config';

interface SearchResult {
  id: string;
  distance: number;
  content: string;
}

function isSearchResultArray(data: unknown): data is SearchResult[] {
  return Array.isArray(data) && data.every(item =>
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'distance' in item &&
    'content' in item
  );
}

/**
 * Search for similar documents using vector similarity
 * @param client ClickHouse client instance
 * @param config ClickHouse configuration
 * @param embedding 256-dimensional vector from text-embedding-3-large model
 * @param options Search options (threshold and limit)
 * @returns Array of similar documents with distance scores
 * @throws Error if embedding dimensions are incorrect or response format is unexpected
 */
export const searchSimilar = async (
  client: ClickHouseClient,
  config: Config,
  embedding: number[],
  { limit = 10, threshold = 0.8 } = {}
): Promise<SearchResult[]> => {
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

  const rawData = await result.json();
  if (!Array.isArray(rawData)) {
    throw new Error('Unexpected response format: expected array');
  }

  // Handle both nested and flat array responses
  if (rawData.length === 0) {
    return [];
  }

  if (Array.isArray(rawData[0])) {
    // Handle nested array response
    const flatData = rawData.flat();
    if (!isSearchResultArray(flatData)) {
      throw new Error('Invalid search result format in nested array response');
    }
    return flatData;
  }

  // Handle flat array response
  if (!isSearchResultArray(rawData)) {
    throw new Error('Invalid search result format in flat array response');
  }
  return rawData;
};
