import { Config } from '../src/config'

export const getMaterializedViewSchema = (config: Config): string => `
CREATE MATERIALIZED VIEW IF NOT EXISTS ${config.database}.${config.dataTable}_mv
TO ${config.database}.${config.dataTable}
AS SELECT
  id,
  metadata,
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
  CAST(1 AS Int8) as sign
FROM ${config.database}.${config.oplogTable}
WHERE sign = 1;
`
