export interface ListQueryable {
  listPrepend(key: string, value: string): Promise<void>

  listAppend(key: string, value: string): Promise<void>

  listRemoveLast(key: string): Promise<any>

  listRemoveAll(key: string, value: string | string[]): Promise<void>

  listTrim(key: string, start: number, stop: number): Promise<void>

  getListRange(key: string, start: number, stop: number): Promise<any[]>

  listLength(key: string): Promise<number>
}
