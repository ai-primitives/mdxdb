import { describe, it, expect, beforeEach } from 'vitest';
import { searchSimilar } from '../src/search';
import type { ClickHouseClient, QueryParams } from '@clickhouse/client-web';
import type { Config } from '../src/config';

interface MockResult {
  id: string;
  distance: number;
  content: string;
}

interface SearchQueryParams extends QueryParams {
  embedding: number[];
}

describe('Vector Search', () => {
  let mockClient: ClickHouseClient;
  let mockConfig: Config;

  beforeEach(() => {
    // Mock configuration
    mockConfig = {
      host: 'http://localhost',
      port: 8123,
      username: 'default',
      password: '',
      database: 'test_db',
      oplogTable: 'oplog',
      dataTable: 'data'
    };

    // Mock client with query implementation
    mockClient = {
      query: async ({ query, query_params }: { query: string, query_params?: SearchQueryParams }) => ({
        json: async (): Promise<MockResult[]> => {
          // Return mock results based on the query
          if (query.includes('cosineDistance') && query_params?.embedding) {
            let results: MockResult[] = [
              { id: 'test1', distance: 0.05, content: 'test content 1' },
              { id: 'test2', distance: 0.08, content: 'test content 2' }
            ];

            // First apply threshold filtering if present
            const thresholdMatch = query.match(/HAVING distance <= \(1 - ([\d.]+)\)/);
            if (thresholdMatch) {
              const threshold = parseFloat(thresholdMatch[1]);
              results = results.filter(r => r.distance <= (1 - threshold));
            }

            // Then apply limit if present (after threshold filtering)
            const limitMatch = query.match(/LIMIT (\d+)/);
            if (limitMatch) {
              results = results.slice(0, parseInt(limitMatch[1], 10));
            }

            return results;
          }
          return [];
        }
      })
    } as unknown as ClickHouseClient;
  });

  it('should find similar documents using cosine distance', async () => {
    const embedding = Array(256).fill(0.1);
    const results = await searchSimilar(mockClient, mockConfig, embedding);

    expect(Array.isArray(results)).toBe(true);
    const typedResults = results as MockResult[];
    expect(typedResults.length).toBe(2);
    expect(typedResults[0]).toHaveProperty('distance');
    expect(typedResults[0].distance).toBeLessThanOrEqual(1);
  });

  it('should respect the limit parameter', async () => {
    const embedding = Array(256).fill(0.1);
    const limit = 1;
    const results = await searchSimilar(mockClient, mockConfig, embedding, { limit });

    expect(Array.isArray(results)).toBe(true);
    const typedResults = results as MockResult[];
    expect(typedResults.length).toBe(1);
  });

  it('should respect the threshold parameter', async () => {
    const embedding = Array(256).fill(0.1);
    const threshold = 0.9;
    const results = await searchSimilar(mockClient, mockConfig, embedding, { threshold });

    expect(Array.isArray(results)).toBe(true);
    (results as MockResult[]).forEach(result => {
      expect(result.distance).toBeLessThanOrEqual(1 - threshold);
    });
  });

  it('should throw error for invalid embedding dimensions', async () => {
    const invalidEmbedding = Array(128).fill(0.1);
    await expect(() =>
      searchSimilar(mockClient, mockConfig, invalidEmbedding)
    ).rejects.toThrow('Embedding must be a 256-dimensional vector');
  });
});
