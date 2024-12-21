-- Materialized view schema for ClickHouse provider
-- Created: 2024-03-16
-- Updated: 2024-03-16

SET allow_experimental_json_type = 1;

-- Materialized view to stream data from oplog to data table
CREATE MATERIALIZED VIEW IF NOT EXISTS mdxdb.dataMv
TO mdxdb.dataTable
AS SELECT
    id,
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
    1 as sign
FROM mdxdb.opLog;
