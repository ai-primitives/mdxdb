export const getDatabaseSchema = (databaseName) => `
CREATE DATABASE IF NOT EXISTS ${databaseName}
`;
export const getTablesSchema = (databaseName) => `
CREATE TABLE IF NOT EXISTS ${databaseName}.oplog (
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
    version UInt64
) ENGINE = MergeTree
ORDER BY (id, version);

CREATE TABLE IF NOT EXISTS ${databaseName}.data (
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
    sign Int8
) ENGINE = VersionedCollapsingMergeTree(sign, version)
ORDER BY (id, version);
`;
export const getMaterializedViewSchema = (databaseName) => `
CREATE MATERIALIZED VIEW IF NOT EXISTS ${databaseName}.dataMv
TO ${databaseName}.data
AS SELECT
    id,
    type,
    ns,
    host,
    path,
    data,
    content,
    ts,
    hash,
    version,
    1 as sign
FROM ${databaseName}.oplog;
`;
