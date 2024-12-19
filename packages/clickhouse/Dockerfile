FROM clickhouse/clickhouse-server:latest

RUN apt-get update && \
    apt-get install -y \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV CLICKHOUSE_LOG_LEVEL=trace

RUN mkdir -p /etc/clickhouse-server/config.d /docker-entrypoint-initdb.d

COPY ./config /etc/clickhouse-server/config.d/
COPY ./schema /docker-entrypoint-initdb.d/
