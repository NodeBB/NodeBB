export interface HashQueryable {
  decrObjectField(
    key: string | string[],
    field: string,
  ): Promise<number | number[]>

  deleteObjectField(key: string, field: string): Promise<void>

  deleteObjectFields(key: string, fields: string[]): Promise<void>

  getObject(key: string, fields: string[]): Promise<object>

  getObjectField(key: string, field: string): Promise<any>

  getObjectFields(key: string, fields: string[]): Promise<Record<string, any>>

  getObjectKeys(key: string): Promise<string[]>

  getObjectValues(key: string): Promise<any[]>

  getObjects(keys: string[], fields: string[]): Promise<any[]>

  getObjectsFields(
    keys: string[],
    fields: string[],
  ): Promise<Record<string, any>[]>

  incrObjectField(
    key: string | string[],
    field: string,
  ): Promise<number | number[]>

  incrObjectFieldBy(
    key: string | string[],
    field: string,
    value: number,
  ): Promise<number | number[]>

  incrObjectFieldByBulk(
    data: [key: string, batch: Record<string, number>][],
  ): Promise<void>

  isObjectField(key: string, field: string): Promise<boolean>

  isObjectFields(key: string, fields: string[]): Promise<boolean[]>

  setObject(key: string | string[], data: Record<string, any>): Promise<void>

  setObjectBulk(args: [key: string, data: Record<string, any>][]): Promise<void>

  setObjectField(
    key: string | string[],
    field: string,
    value: any,
  ): Promise<void>
}
