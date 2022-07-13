import {
  NumberTowardsMaxima,
  NumberTowardsMinima,
  RedisStyleAggregate,
  RedisStyleMatchString,
  RedisStyleRangeString,
  ValueAndScore,
} from './index'

export type SortedSetTheoryOperation = {
  sets: string[]
  start?: number
  stop?: number
  weights?: number[]
  aggregate?: RedisStyleAggregate
}

export type SortedSetScanBaseParameters = {
  key: string
  match: RedisStyleMatchString
  limit: number
}

export interface SortedSetQueryable {
  getSortedSetIntersect(
    params: SortedSetTheoryOperation & { withScores: true },
  ): Promise<ValueAndScore[]>

  getSortedSetIntersect(
    params: SortedSetTheoryOperation & { withScores: false },
  ): Promise<string[]>

  getSortedSetMembers(key: string): Promise<string[]>

  getSortedSetRange(
    key: string | string[],
    start: number,
    stop: number,
  ): Promise<string[]>

  getSortedSetRangeByLex(
    key: string | string[],
    min: RedisStyleRangeString,
    max: RedisStyleRangeString,
    start: number,
    count: number,
  ): Promise<string[]>

  getSortedSetRangeByScore(
    key: string | string[],
    start: number,
    count: number,
    min: NumberTowardsMinima,
    max: NumberTowardsMaxima,
  ): Promise<string[]>

  getSortedSetRangeByScoreWithScores(
    key: string | string[],
    start: number,
    count: number,
    min: NumberTowardsMinima,
    max: NumberTowardsMaxima,
  ): Promise<ValueAndScore[]>

  getSortedSetRangeWithScores(
    key: string | string[],
    start: number,
    stop: number,
  ): Promise<ValueAndScore[]>

  getSortedSetRevIntersect(
    params: SortedSetTheoryOperation & { withScores: true },
  ): Promise<ValueAndScore[]>

  getSortedSetRevIntersect(
    params: SortedSetTheoryOperation & { withScores: false },
  ): Promise<string[]>

  getSortedSetRevRange(
    key: string | string[],
    start: number,
    stop: number,
  ): Promise<string[]>

  getSortedSetRevRangeByLex(
    key: string,
    max: RedisStyleRangeString,
    min: RedisStyleRangeString,
    start: number,
    count: number,
  ): Promise<string[]>

  getSortedSetRevRangeByScore(
    key: string,
    start: number,
    count: number,
    max: NumberTowardsMaxima,
    min: NumberTowardsMinima,
  ): Promise<string[]>

  getSortedSetRevRangeByScoreWithScores(
    key: string,
    start: number,
    count: number,
    max: NumberTowardsMaxima,
    min: NumberTowardsMinima,
  ): Promise<ValueAndScore[]>

  getSortedSetRevRangeWithScores(
    key: string,
    start: number,
    stop: number,
  ): Promise<ValueAndScore[]>

  getSortedSetRevUnion(
    params: SortedSetTheoryOperation & { withScores: false },
  ): Promise<string[]>

  getSortedSetRevUnion(
    params: SortedSetTheoryOperation & { withScores: true },
  ): Promise<ValueAndScore[]>

  getSortedSetScan(
    params: SortedSetScanBaseParameters & { withScores: true },
  ): Promise<ValueAndScore[]>

  getSortedSetScan(
    params: SortedSetScanBaseParameters & { withScores: false },
  ): Promise<string[]>

  getSortedSetUnion(
    params: SortedSetTheoryOperation & { withScores: true },
  ): Promise<ValueAndScore[]>

  getSortedSetUnion(
    params: SortedSetTheoryOperation & { withScores: false },
  ): Promise<string[]>

  getSortedSetsMembers(keys: string[]): Promise<string[][]>

  isMemberOfSortedSets(keys: string[], value: string): Promise<boolean[]>

  isSortedSetMember(key: string, value: string): Promise<boolean>

  isSortedSetMembers(key: string, values: string[]): Promise<boolean[]>

  processSortedSet(
    setKey: string,
    processFn: (ids: number[]) => Promise<void> | void,
    options: { withScores?: boolean; batch?: number; interval?: number },
  ): Promise<any>

  sortedSetAdd(key: string, score: number, value: string): Promise<void>

  sortedSetAdd(key: string, score: number[], value: string[]): Promise<void>

  sortedSetAddBulk(
    args: [key: string, score: number[], value: string[]][],
  ): Promise<void>

  sortedSetCard(key: string): Promise<number>

  sortedSetCount(
    key: string,
    min: NumberTowardsMinima,
    max: NumberTowardsMaxima,
  ): Promise<number>

  sortedSetIncrBy(
    key: string,
    increment: number,
    value: string,
  ): Promise<number>

  sortedSetIncrByBulk(
    data: [key: string, increment: number, value: string][],
  ): Promise<number[]>

  sortedSetIntersectCard(keys: string[]): Promise<number>

  sortedSetLexCount(
    key: string,
    min: RedisStyleRangeString,
    max: RedisStyleRangeString,
  ): Promise<number>

  sortedSetRank(key: string, value: string): Promise<number>

  sortedSetRanks(key: string, values: string[]): Promise<number[]>

  sortedSetRemove(
    key: string | string[],
    value: string | string[],
  ): Promise<void>

  sortedSetRemoveBulk(data: [key: string, member: string][]): Promise<void>

  sortedSetRemoveRangeByLex(
    key: string,
    min: RedisStyleRangeString,
    max: RedisStyleRangeString,
  ): Promise<void>

  sortedSetRevRank(key: string, value: string): Promise<number>

  sortedSetRevRanks(key: string, values: string[]): Promise<number[]>

  sortedSetScore(key: string, value: string): Promise<number | null>

  sortedSetScores(key: string, values: string[]): Promise<number[]>

  sortedSetUnionCard(keys: string[]): Promise<number>

  sortedSetsAdd(
    keys: string[],
    scores: number | number[],
    value: string,
  ): Promise<void>

  sortedSetsCard(keys: string[]): Promise<number[]>

  sortedSetsCardSum(keys: string[]): Promise<number>

  sortedSetsRanks<T extends readonly [] | readonly string[]>(
    keys: T,
    values: { [K in keyof T]: string },
  ): Promise<number[]>

  sortedSetsRemove(keys: string[], value: string): Promise<void>

  sortedSetsRemoveRangeByScore(
    keys: string[],
    min: NumberTowardsMinima,
    max: NumberTowardsMaxima,
  ): Promise<void>

  sortedSetsRevRanks(keys: string[], values: string[]): Promise<number[]>

  sortedSetsScore(keys: string[], value: string): Promise<number[]>
}
