import {Store} from 'express-session'
import {StringQueryable} from "./string";
import {ListQueryable} from "./list";
import {HashSetQueryable} from "./set";
import {SortedSetQueryable} from "./zset";
import {HashQueryable} from "./hash";


export interface INodeBBDatabaseBackend extends
  StringQueryable,
  ListQueryable,
  HashSetQueryable,
  SortedSetQueryable,
  HashQueryable {
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
export type RedisStyleRangeString = `${'(' | '['}${number}`
export type RedisStyleRangeStringWithLex =
  | RedisStyleRangeString
  | '-inf'
  | '+inf'

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

export {HashQueryable} from './hash'
export {ListQueryable} from './list'
export {HashSetQueryable} from './set'
export {StringQueryable} from './string'
export {
  SortedSetQueryable,
  SortedSetTheoryOperation,
  SortedSetScanBaseParameters,
} from './zset'