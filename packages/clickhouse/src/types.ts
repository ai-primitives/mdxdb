/**
 * Type definitions for ClickHouse provider
 */

/**
 * Hash map structure for document identifiers
 * Enables UUID-like functionality with decodable metadata
 */
export interface HashMap {
  /** Hash of the document ID */
  id: number;
  /** Hash of the namespace */
  ns: number;
  /** Array of path segment hashes */
  path: number[];
  /** Hash of the document data */
  data: number;
  /** Hash of the document content */
  content: number;
}

/**
 * Example hash map structure:
 * {
 *   "id": 123456,
 *   "ns": 789012,
 *   "path": [345678, 901234],
 *   "data": 567890,
 *   "content": 234567
 * }
 */
