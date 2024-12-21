import { Config } from '../src/config'

export const getTablesSchema = (config: Config): string => `
CREATE TABLE IF NOT EXISTS ${config.database}.${config.oplogTable} (
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
  sign Int8
) ENGINE = VersionedCollapsingMergeTree(sign, version)
PRIMARY KEY (id)
ORDER BY (id, ns, type, version);

CREATE TABLE IF NOT EXISTS ${config.database}.${config.dataTable} (
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
  sign Int8
) ENGINE = VersionedCollapsingMergeTree(sign, version)
PRIMARY KEY (id)
ORDER BY (id, ns, type, version);
`
