/**
 * Base interface for MDX content with JSON-LD support
 */
export interface MDXLD {
  /** Required document identifier - must be at root level for JSON-LD compatibility */
  id: string
  /** Required document content */
  content: string
  /** Required document data with JSON-LD properties */
  data: {
    /** JSON-LD identifier (matches root id) */
    $id: string
    /** JSON-LD type */
    $type: string
    /** Optional JSON-LD context */
    $context?: string | Record<string, unknown>
    /** Additional data properties */
    [key: string]: unknown
  }
  /** Required metadata for document tracking */
  metadata: {
    /** Document identifier (matches root id) */
    id: string
    /** Document type (matches data.$type) */
    type: string
    /** Optional timestamp */
    ts?: number
    /** Optional namespace */
    ns?: string
    /** Optional host information */
    host?: string
    /** Optional path segments */
    path?: string[]
    /** Optional content description */
    content?: string
    /** Optional additional metadata */
    data?: Record<string, unknown>
    /** Optional version number */
    version?: number
    /** Optional hash information */
    hash?: Record<string, unknown>
  }
  /** Optional vector embeddings for similarity search */
  embeddings?: number[]
  /** Optional list of collection names this document belongs to */
  collections?: string[]
}
