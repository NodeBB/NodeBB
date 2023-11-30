export interface HashSetQueryable {
  getSetMembers(key: string): Promise<string[]>

  getSetsMembers(keys: string[]): Promise<string[][]>

  isMemberOfSets(sets: string[], value: string): Promise<boolean[]>

  isSetMember(key: string, value: string): Promise<boolean>

  isSetMembers(key: string, values: string[]): Promise<boolean[]>

  setAdd(key: string, value: string | string[]): Promise<void>

  setCount(key: string): Promise<number>

  setRemove(key: string | string[], value: string | string[]): Promise<void>

  setRemoveRandom(key: string): Promise<string>

  setsAdd(keys: string[], value: string | string[]): Promise<void>

  setsCount(keys: string[]): Promise<number[]>

  setsRemove(keys: string[], value: string): Promise<void>
}
