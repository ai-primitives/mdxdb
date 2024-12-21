import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { createClient } from '@clickhouse/client-web';
import { dockerTestConfig } from '../docker.config';
import '../setup';
describe('ClickHouse Search Tests', () => {
    const client = createClient({
        url: `${dockerTestConfig.protocol}://${dockerTestConfig.host}:${dockerTestConfig.port}`,
        database: dockerTestConfig.database,
        username: dockerTestConfig.username,
        password: dockerTestConfig.password,
        clickhouse_settings: {
            allow_experimental_json_type: 1,
            allow_experimental_full_text_index: 1,
            allow_experimental_vector_similarity_index: 1
        }
    });
    beforeAll(async () => {
        // Database initialization is handled in setup.ts
        // Insert test data
        await client.exec({
            query: `
        INSERT INTO ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
        SELECT
          '{"id":"test1","type":"document","ts":"' || toString(now64()) || '"}' as metadata,
          'document' as type,
          'test' as ns,
          'hash1' as hash,
          '{"content": "test document"}' as data,
          [${Array(256).fill(0.1).join(',')}] as embedding,
          now() as timestamp
      `
        });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for materialized view to be ready
    });
    afterAll(async () => {
        try {
            await client.exec({
                query: `TRUNCATE TABLE IF EXISTS ${dockerTestConfig.database}.${dockerTestConfig.dataTable}`
            });
            await client.close();
        }
        catch (error) {
            console.error('Failed to clean up:', error);
        }
    });
    test('full-text search works with exact match', async () => {
        const result = await client.query({
            query: `
        SELECT
          JSONExtractString(metadata, 'id') as id,
          content
        FROM ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
        WHERE content = 'test document'
        LIMIT 1
      `,
            format: 'JSONEachRow'
        });
        const rows = await result.json();
        expect(rows.length).toBe(1);
        expect(rows[0].content).toBe('test document');
    });
    test('full-text search works with LIKE operator', async () => {
        const result = await client.query({
            query: `
        SELECT
          JSONExtractString(metadata, 'id') as id,
          content,
          data
        FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
        WHERE content LIKE '%test%'
        LIMIT 1
      `,
            format: 'JSONEachRow'
        });
        const rows = await result.json();
        expect(rows.length).toBe(1);
    });
    test('full-text search returns empty result for non-matching content', async () => {
        const result = await client.query({
            query: `
        SELECT *
        FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
        WHERE data LIKE '%nonexistent%'
        LIMIT 1
      `,
            format: 'JSONEachRow'
        });
        const rows = await result.json();
        expect(rows.length).toBe(0);
    });
    test('vector similarity search works with cosineDistance', async () => {
        const testVector = Array(256).fill(0.1);
        const result = await client.query({
            query: `
        SELECT *,
               cosineDistance(embedding, [${testVector.join(',')}]) as distance
        FROM ${dockerTestConfig.database}.${dockerTestConfig.dataTable}
        ORDER BY distance ASC
        LIMIT 1
      `,
            format: 'JSONEachRow'
        });
        const rows = await result.json();
        expect(rows.length).toBe(1);
        expect(rows[0].distance).toBeCloseTo(0, 5);
    });
    test('vector similarity search returns results in ascending distance order', async () => {
        // Insert another test document with a different embedding
        await client.exec({
            query: `
        INSERT INTO mdxdb.oplog
        SELECT
          '{"id":"test2","type":"document","ts":"' || toString(now64()) || '"}' as metadata,
          'document' as type,
          'test' as ns,
          'hash2' as hash,
          '{"content": "another test"}' as data,
          [${Array(256).fill(0.5).join(',')}],
          now() as timestamp
      `
        });
        // Use a search vector that's closer to the first document (0.1) than the second (0.5)
        const searchVector = Array(256).fill(0.12);
        const result = await client.query({
            query: `
        SELECT
          JSONExtractString(metadata, 'id') as id,
          cosineDistance(embedding, [${searchVector.join(',')}]) as distance
        FROM ${dockerTestConfig.database}.${dockerTestConfig.oplogTable}
        WHERE type = 'document'
        ORDER BY distance ASC
        LIMIT 2
      `,
            format: 'JSONEachRow'
        });
        const rows = await result.json();
        expect(rows.length).toBe(2);
        expect(rows[0].distance).toBeLessThan(rows[1].distance);
    });
});
//# sourceMappingURL=search.test.js.map