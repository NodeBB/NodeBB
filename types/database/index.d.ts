import { Store } from 'express-session'

export { Hash } from './hash'
export { List } from './list'
export { Set } from './set'
export { Item } from './string'
export {
  SortedSet,
  SortedSetTheoryOperation,
  SortedSetScanBaseParameters,
} from './zset'

export interface Database {
  checkCompatibility(callback: () => void): Promise<void>

  checkCompatibilityVersion(
    version: string,
    callback: () => void,
  ): Promise<void>

  close(): Promise<void>

  createIndices(callback: () => void): Promise<void>

  createSessionStore(options: any): Promise<Store>

  emptydb(): Promise<void>

  flushdb(): Promise<void>

  info(db: any): Promise<any>

  init(): Promise<void>
}

export type RedisStyleMatchString =
  | string
  | `*${string}`
  | `${string}*`
  | `*${string}*`
export type RedisStyleRangeString = `${'(' | '['}${string}` | `${string}`

export enum ObjectType {
  HASH = 'hash',
  LIST = 'list',
  SET = 'set',
  STRING = 'string',
  SORTED_SET = 'zset',
}

export type ValueAndScore = { value: string; score: number }
export type RedisStyleAggregate = 'SUM' | 'MIN' | 'MAX'
export type NumberTowardsMinima = number | '-inf'
export type NumberTowardsMaxima = number | '+inf'
