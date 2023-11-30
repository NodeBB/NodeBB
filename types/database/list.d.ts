export interface ListQueryable {
  listPrepend(key: string, value: string): Promise<void>

  listAppend(key: string, value: string): Promise<void>

  listRemoveLast(key: string): Promise<string | null>

  listRemoveAll(key: string, value: string | string[]): Promise<void>

  listTrim(key: string, start: number, stop: number): Promise<void>

  getListRange(key: string, start: number, stop: number): Promise<string[]>

  listLength(key: string): Promise<number>
}
