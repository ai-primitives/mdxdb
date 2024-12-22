import type { Document } from './document.js'

export type FilterOperator<T> = {
  $eq?: T
  $gt?: T
  $gte?: T
  $lt?: T
  $lte?: T
  $in?: T[]
  $nin?: T[]
}

export type MetadataFilter = {
  type?: string | FilterOperator<string>
  ns?: string | FilterOperator<string>
  host?: string | FilterOperator<string>
  path?: string[] | FilterOperator<string[]>
  content?: string | FilterOperator<string>
  data?: Record<string, unknown> | FilterOperator<Record<string, unknown>>
  version?: number | FilterOperator<number>
  hash?: Record<string, unknown> | FilterOperator<Record<string, unknown>>
  ts?: number | FilterOperator<number>
} & {
  [key: string]: unknown
}

export type NestedFilterQuery<T> = {
  [P in keyof T]?: T[P] extends Record<string, unknown>
    ? FilterOperator<T[P]> | {
        [K in keyof T[P]]?: T[P][K] extends Record<string, unknown>
          ? FilterOperator<T[P][K]> | {
              [L in keyof T[P][K]]?: T[P][K][L] | FilterOperator<T[P][K][L]>
            }
          : T[P][K] | FilterOperator<T[P][K]>
      }
    : T[P] | FilterOperator<T[P]>
}

export type FilterQuery<T extends Document> = NestedFilterQuery<T> & {
  [P in keyof T]?: T[P] extends Record<string, unknown>
    ? P extends 'metadata'
      ? MetadataFilter
      : P extends 'data'
      ? {
          [K in keyof T[P]]?: T[P][K] extends Record<string, unknown>
            ? FilterOperator<T[P][K]> | {
                [L in keyof T[P][K]]?: T[P][K][L] | FilterOperator<T[P][K][L]>
              }
            : T[P][K] | FilterOperator<T[P][K]>
        }
      : T[P] | FilterOperator<T[P]>
    : T[P] | FilterOperator<T[P]>
} & {
  $and?: FilterQuery<T>[]
  $or?: FilterQuery<T>[]
  $not?: FilterQuery<T>
} & {
  [key: `data.${string}`]: unknown
  [key: `data.${string}.${string}`]: unknown
  [key: `metadata.${string}`]: unknown
  [key: `metadata.${string}.${string}`]: unknown
}
