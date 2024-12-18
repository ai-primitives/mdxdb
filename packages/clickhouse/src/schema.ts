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
    hash,
    version,
    1 as sign
FROM ${databaseName}.oplog;
`;

export interface TableSchema {
  name: string
  engine: string
  columns: {
    name: string
    type: string
    description?: string
  }[]
}

export interface HashMap {
  id: number;
  ns: number;
  path: number[];
  data: number;
  content: number;
}
