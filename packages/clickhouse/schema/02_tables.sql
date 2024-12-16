-- Versions table with ReplacingMergeTree
CREATE TABLE IF NOT EXISTS mdxdb.versions (
    id String,
    data String CODEC(ZSTD(1)), -- JSON frontmatter
    content String CODEC(ZSTD(1)),
    ast String CODEC(ZSTD(1)), -- JSON AST
    createdAt Int32,
    createdBy String,
    updatedAt Int32,
    updatedBy String,
    visibility String,
    version UInt64
) ENGINE = ReplacingMergeTree(version)
PRIMARY KEY (id);

-- Content table as target for materialized view
CREATE TABLE IF NOT EXISTS mdxdb.content (
    id String,
    data String CODEC(ZSTD(1)),
    content String CODEC(ZSTD(1)),
    ast String CODEC(ZSTD(1)),
    createdAt Int32,
    createdBy String,
    updatedAt Int32,
    updatedBy String,
    visibility String
) ENGINE = ReplacingMergeTree()
PRIMARY KEY (id);
