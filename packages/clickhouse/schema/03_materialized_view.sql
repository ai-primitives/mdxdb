-- Materialized view to stream oplog to data
CREATE MATERIALIZED VIEW IF NOT EXISTS mdxdb.contentView
TO mdxdb.data
AS SELECT
    id,
    data,
    content,
    ast,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
    visibility,
    1 as sign,
    toUInt64(updatedAt) as version
FROM mdxdb.oplog
ORDER BY id;
