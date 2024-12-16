-- Materialized view to stream versions to content
CREATE MATERIALIZED VIEW IF NOT EXISTS mdxdb.contentView
TO mdxdb.content
AS SELECT
    id,
    data,
    content,
    ast,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
    visibility
FROM mdxdb.versions
ORDER BY id;
