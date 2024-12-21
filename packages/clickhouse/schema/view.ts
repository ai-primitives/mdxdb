import { Config } from '../src/config'

export const getMaterializedViewSchema = (config: Config): string => `
CREATE MATERIALIZED VIEW IF NOT EXISTS ${config.database}.${config.dataTable}_mv
TO ${config.database}.${config.dataTable}
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
FROM ${config.database}.${config.oplogTable}
WHERE sign = 1;
`
