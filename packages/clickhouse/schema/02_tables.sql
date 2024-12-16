-- Operation log table with MergeTree
CREATE TABLE IF NOT EXISTS mdxdb.oplog (
    id String,
    data String CODEC(ZSTD(1)), -- JSON frontmatter
    content String CODEC(ZSTD(1)),
    ast String CODEC(ZSTD(1)), -- JSON AST
    createdAt Int32,
    createdBy String,
    updatedAt Int32,
    updatedBy String,
    visibility String
) ENGINE = MergeTree()
PRIMARY KEY (id);

-- Data table with versioning and delete support
CREATE TABLE IF NOT EXISTS mdxdb.data (
    id String,
    data String CODEC(ZSTD(1)),
    content String CODEC(ZSTD(1)),
    ast String CODEC(ZSTD(1)),
    createdAt Int32,
    createdBy String,
    updatedAt Int32,
    updatedBy String,
    visibility String,
    sign Int8, -- Required for VersionedCollapsingMergeTree: 1 for state, -1 for cancel
    version UInt64 -- Required for versioning
) ENGINE = VersionedCollapsingMergeTree(sign, version)
PRIMARY KEY (id);
