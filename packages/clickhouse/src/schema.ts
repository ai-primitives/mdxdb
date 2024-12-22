export const getDatabaseSchema = (databaseName: string): string => `
CREATE DATABASE IF NOT EXISTS ${databaseName}
`;

export const getTablesSchema = (
  databaseName: string,
  oplogTableName: string = 'oplog',
  dataTableName: string = 'data'
): string => `
CREATE TABLE IF NOT EXISTS ${databaseName}.${oplogTableName} (
    id String,
    metadata JSON,
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
) ENGINE = MergeTree()
ORDER BY (id, version);

CREATE TABLE IF NOT EXISTS ${databaseName}.${dataTableName} (
    id String,
    metadata JSON,
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
) ENGINE = MergeTree()
PRIMARY KEY (id)
ORDER BY (id, ns, type, version);
`;

export const getMaterializedViewSchema = (
  databaseName: string,
  oplogTableName: string = 'oplog',
  dataTableName: string = 'data'
): string => `CREATE MATERIALIZED VIEW IF NOT EXISTS ${databaseName}.dataMv
TO ${databaseName}.${dataTableName}
AS SELECT
    id,
    metadata,
    type,
    ns,
    host,
    path,
    data,
    content,
    embedding,
    ts,
    hash,
    version,
    CAST(1 AS Int8) as sign
FROM ${databaseName}.${oplogTableName}
WHERE sign = 1;`;

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
