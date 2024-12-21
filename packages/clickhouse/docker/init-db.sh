#!/bin/bash

# Wait for ClickHouse to start
until clickhouse-client --host localhost --query "SELECT 1"
do
    echo "Waiting for ClickHouse to start..."
    sleep 1
done

# Create database and tables
clickhouse-client --host localhost --query "CREATE DATABASE IF NOT EXISTS mdxdb"

# Set up experimental features
clickhouse-client --host localhost --query "SET allow_experimental_json_type = 1"
clickhouse-client --host localhost --query "SET allow_experimental_full_text_index = 1"
clickhouse-client --host localhost --query "SET allow_experimental_vector_similarity_index = 1"
