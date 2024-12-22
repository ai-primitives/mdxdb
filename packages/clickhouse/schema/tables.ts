import { Config } from '../src/config'

export const getTablesSchema = (config: Config): string => `
CREATE TABLE IF NOT EXISTS ${config.database}.${config.oplogTable} (
  id String,
  metadata JSON,
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
PRIMARY KEY (id)
ORDER BY (id, version);

CREATE TABLE IF NOT EXISTS ${config.database}.${config.dataTable} (
  id String,
  metadata JSON,
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
PRIMARY KEY (id)
ORDER BY (id, version);
`
