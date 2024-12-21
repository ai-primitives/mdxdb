import { Config } from '../src/config'

export const getDatabaseSchema = (config: Config): string => `
CREATE DATABASE IF NOT EXISTS ${config.database};
`
