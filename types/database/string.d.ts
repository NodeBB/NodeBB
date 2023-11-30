import { ObjectType, RedisStyleMatchString } from './index'

export interface StringQueryable {
  delete(key: string): Promise<void>

  deleteAll(keys: string[]): Promise<void>

  exists(key: string): Promise<boolean>

  exists(key: string[]): Promise<boolean[]>

  expire(key: string, seconds: number): Promise<void>

  expireAt(key: string, timestampInSeconds: number): Promise<void>

  get(key: string): Promise<string | null>

  increment(key: string): Promise<number>

  pexpire(key: string, ms: number): Promise<void>

  pexpireAt(key: string, timestampInMs: number): Promise<void>

  pttl(key: string): Promise<number>

  rename(oldkey: string, newkey: string): Promise<void>

  scan(params: { match: RedisStyleMatchString }): Promise<string[]>

  set(key: string, value: string): Promise<void>

  ttl(key: string): Promise<number>

  type(key: string): Promise<ObjectType | null>
}
