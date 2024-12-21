import { describe, it, expect, vi } from 'vitest';
import { createClickHouseClient } from '../src';
import { createClient } from '@clickhouse/client-web';
vi.mock('@clickhouse/client-web', () => ({
    createClient: vi.fn().mockReturnValue({
        ping: vi.fn().mockResolvedValue({ success: true }),
        exec: vi.fn().mockResolvedValue({ success: true }),
        query: vi.fn().mockImplementation(() => {
            return Promise.resolve({
                json: () => Promise.resolve([{ version: '24.11.0' }])
            });
        })
    })
}));
describe('ClickHouse Client', () => {
    it('should create client with valid config', async () => {
        const config = {
            host: 'localhost',
            port: 8123,
            username: 'default',
            password: '',
            database: 'test_db',
            oplogTable: 'oplog',
            dataTable: 'data',
            clickhouse_settings: {
                allow_experimental_json_type: 1,
                allow_experimental_full_text_index: 1,
                allow_experimental_vector_similarity_index: 1
            }
        };
        const client = await createClickHouseClient(config);
        expect(client).toBeDefined();
        // Verify client is created with correct URL format
        expect(createClient).toHaveBeenCalledWith({
            host: `http://${config.host}:${config.port}`,
            username: config.username,
            password: config.password,
            database: config.database,
            clickhouse_settings: {
                allow_experimental_json_type: 1,
                allow_experimental_full_text_index: 1,
                allow_experimental_vector_similarity_index: 1
            }
        });
    });
});
//# sourceMappingURL=client.test.js.map