FROM clickhouse/clickhouse-server:latest

RUN apt-get update && \
    apt-get install -y \
    curl \
    wget \
    procps \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV CLICKHOUSE_LOG_LEVEL=trace
