#!/bin/bash
set -e

# Wait for ClickHouse server to be ready
until clickhouse-client --query "SELECT 1" >/dev/null 2>&1; do
    echo "Waiting for ClickHouse server to start..."
    sleep 1
done

clickhouse-client -n <<-EOSQL
    SET allow_experimental_json_type = 1;
    SET allow_experimental_full_text_index = 1;
    SET allow_experimental_vector_similarity_index = 1;
    
    CREATE DATABASE IF NOT EXISTS mdxdb;
    
    CREATE TABLE IF NOT EXISTS mdxdb.oplog (
        id String,
        type String,
        ns String,
        host String,
        path Array(String),
        data JSON,
        content String,
        embedding Array(Float32),
        ts UInt32,
        hash JSON,
        version UInt64,
        sign Int8,
        INDEX idx_content content TYPE full_text GRANULARITY 1,
        INDEX idx_embedding embedding TYPE vector_similarity('hnsw', 'cosineDistance')
    ) ENGINE = MergeTree
    ORDER BY (id, version);
    
    CREATE TABLE IF NOT EXISTS mdxdb.data (
        id String,
        type String,
        ns String,
        host String,
        path Array(String),
        data JSON,
        content String,
        embedding Array(Float32),
        ts UInt32,
        hash JSON,
        version UInt64,
        sign Int8,
        INDEX idx_content content TYPE full_text GRANULARITY 1,
        INDEX idx_embedding embedding TYPE vector_similarity('hnsw', 'cosineDistance')
    ) ENGINE = VersionedCollapsingMergeTree(sign, version)
    ORDER BY (id, version);
    
    CREATE MATERIALIZED VIEW IF NOT EXISTS mdxdb.dataMv
    TO mdxdb.data
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
        sign
    FROM mdxdb.oplog;
EOSQL
