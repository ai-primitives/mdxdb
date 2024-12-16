-- Tables schema for ClickHouse provider
-- Created: 2024-03-16
-- Updated: 2024-03-16

-- Oplog table with MergeTree engine for append-only operations
CREATE TABLE IF NOT EXISTS ${databaseName}.oplog (
    id String,
    type String,
    ns String,
    host String,
    path Array(String),
    data JSON,
    content String,
    ts UInt32,
    hash JSON, -- Map containing id, ns, path, data, and content hashes
    version UInt64
) ENGINE = MergeTree
ORDER BY (id, version);

-- Data table with VersionedCollapsingMergeTree engine for delete support
CREATE TABLE IF NOT EXISTS ${databaseName}.data (
    id String,
    type String,
    ns String,
    host String,
    path Array(String),
    data JSON,
    content String,
    ts UInt32,
    hash JSON, -- Map containing id, ns, path, data, and content hashes
    version UInt64,
    sign Int8
) ENGINE = VersionedCollapsingMergeTree(sign, version)
ORDER BY (id, version);
