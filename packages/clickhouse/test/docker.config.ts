export const dockerTestConfig = {
  host: process.env.CLICKHOUSE_HOST || 'localhost',
  port: Number(process.env.CLICKHOUSE_PORT) || 8123,
  database: process.env.CLICKHOUSE_DATABASE || 'mdxdb_test',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  protocol: 'http',
  tls: false,
  oplogTable: process.env.CLICKHOUSE_OPLOG_TABLE || 'oplog',
  dataTable: process.env.CLICKHOUSE_DATA_TABLE || 'data'
};
