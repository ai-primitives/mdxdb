import type { Config } from '../src/config.js'

export const dockerTestConfig: Config = {
  host: 'localhost',
  port: 8123,
  database: 'mdxdb',
  username: 'default',
  password: '',
  oplogTable: 'oplog',
  dataTable: 'data',
  clickhouse_settings: {
    allow_experimental_json_type: 1,
    allow_experimental_full_text_index: 1,
    allow_experimental_vector_similarity_index: 1
  }
};
