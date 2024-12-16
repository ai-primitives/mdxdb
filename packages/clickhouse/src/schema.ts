// Schema definitions for ClickHouse database and tables
// Requires ClickHouse v24.10+ for JSON field support

export const getDatabaseSchema = (databaseName: string): string => `
CREATE DATABASE IF NOT EXISTS ${databaseName}
`;

export const getTablesSchema = (databaseName: string): string => `
CREATE TABLE IF NOT EXISTS ${databaseName}.oplog (
    id String,
    type String,
    ns String,
    host String,
    path Array(String),
    data JSON,
    content String,
    ts UInt32,
    hashId UInt32,
    hashNs UInt32,
    hashPath Array(UInt32),
    hashData UInt32,
    hashContent UInt32,
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
    ts UInt32,
    hashId UInt32,
    hashNs UInt32,
    hashPath Array(UInt32),
    hashData UInt32,
    hashContent UInt32,
    version UInt64,
    sign Int8
) ENGINE = VersionedCollapsingMergeTree(sign, version)
ORDER BY (id, version);
`;

export const getMaterializedViewSchema = (databaseName: string): string => `
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
    hashId,
    hashNs,
    hashPath,
    hashData,
    hashContent,
    version,
    1 as sign
FROM ${databaseName}.oplog;
`;
