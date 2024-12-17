-- Tables schema for ClickHouse provider
-- Created: 2024-03-16
-- Updated: 2024-03-16

SET allow_experimental_json_type = 1;
SET allow_experimental_full_text_index = 1;
SET allow_experimental_vector_similarity_index = 1;

-- Oplog table with MergeTree engine for append-only operations
CREATE TABLE IF NOT EXISTS mdxdb.oplog (
    id String,
    type String,
    ns String,
    host String,
    path Array(String),
    data JSON,
    content String,
    embedding Array(Float32),
    ts UInt32,
    hash JSON, -- Map containing id, ns, path, data, and content hashes
    version UInt64,
    INDEX idx_content content TYPE full_text GRANULARITY 1,
    INDEX idx_embedding embedding TYPE vector_similarity('hnsw', 'cosineDistance')
) ENGINE = MergeTree
ORDER BY (id, version);

-- Data table with VersionedCollapsingMergeTree engine for delete support
CREATE TABLE IF NOT EXISTS mdxdb.data (
    id String,
    type String,
    ns String,
    host String,
    path Array(String),
    data JSON,
    content String,
    embedding Array(Float32),
    ts UInt32,
    hash JSON, -- Map containing id, ns, path, data, and content hashes
    version UInt64,
    sign Int8,
    INDEX idx_content content TYPE full_text GRANULARITY 1,
    INDEX idx_embedding embedding TYPE vector_similarity('hnsw', 'cosineDistance')
) ENGINE = VersionedCollapsingMergeTree(sign, version)
ORDER BY (id, version);
