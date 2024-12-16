-- Materialized view schema for ClickHouse provider
-- Created: 2024-03-16
-- Updated: 2024-03-16

-- Materialized view to stream data from oplog to data table
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
