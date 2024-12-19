import type { ClickHouseClient } from '@clickhouse/client-web';
/**
 * Checks if the connected ClickHouse instance meets the minimum version requirements
 * @param client ClickHouse client instance
 * @throws Error if version requirements are not met
 */
export declare const checkClickHouseVersion: (client: ClickHouseClient) => Promise<void>;
/**
 * Derives the namespace from a given ID
 * For paths with API endpoints (e.g., docs.example.com/api), returns the full domain (docs.example.com)
 * For domain-only paths (e.g., docs.example.com), returns the parent domain (example.com)
 * @param id The document ID to derive namespace from
 * @returns The derived namespace
 */
export declare function deriveNamespace(id: string): string;
//# sourceMappingURL=utils.d.ts.map