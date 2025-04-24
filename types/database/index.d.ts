import { Store } from 'express-session'
import { PoolConnection } from 'mysql2/promise'
import { Hash } from './hash'
import { List } from './list'
import { Set } from './set'
import { Item } from './string'
import { SortedSet, SortedSetScanBaseParameters, SortedSetTheoryOperation } from './zset'

export { Hash } from './hash'
export { List } from './list'
export { Set } from './set'
export { Item } from './string'
export {
  SortedSet,
  SortedSetTheoryOperation,
  SortedSetScanBaseParameters,
} from './zset'

export interface Database extends Hash, List, Set, Item, SortedSet, SortedSetTheoryOperation, SortedSetScanBaseParameters {
  checkCompatibility(callback?: () => void): Promise<void>

  checkCompatibilityVersion(
    version: string,
    callback?: () => void,
  ): Promise<void>

  close(): Promise<void>

  createIndices(callback: () => void): Promise<void>

  createSessionStore(options: any): Promise<Store>

  emptydb(): Promise<void>

  flushdb(): Promise<void>

  info(db: any): Promise<any>

  init(opts: any): Promise<void>
}

export interface MySQLDatabase extends Database {
  pool?: import('mysql2/promise').Pool
  client?: import('mysql2/promise').Pool
  transaction(perform: (poolConnection: PoolConnection) => Promise<void>, txClient?: PoolConnection): Promise<void>
}

export interface MySQLDatabaseHelpers {
  ensureLegacyObjectsType(db: PoolConnection, keys: string[], type: string): Promise<void>
  ensureLegacyObjectType(db: PoolConnection, key: string, type: string): Promise<void>
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
