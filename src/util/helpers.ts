import { z } from 'zod'

export const now   = () => Math.floor(Date.now() / 1000)
export const sleep = (ms : number = 1000) => new Promise(res => setTimeout(res, ms))

export function normalize_obj <T extends Record<keyof T, any>> (obj : T) : T {
  if (obj instanceof Map || Array.isArray(obj) || typeof obj !== 'object') {
    return obj
  } else {
    return Object.keys(obj)
      .sort()
      .filter(([ _, value ]) => value !== undefined)
      .reduce<Record<string, any>>((sorted, key) => {
        sorted[key] = obj[key as keyof T]
        return sorted
      }, {}) as T
  }
}

export function parse_error (err : unknown) {
  if (err instanceof Error)    return err.message
  if (typeof err === 'string') return err
  return String(err)
}

export function validate_schema <T> (
  obj      : T,
  schema   : z.ZodSchema,
  err_msg? : string | null
) : obj is T {
  const parsed = schema.safeParse(obj)
  if (parsed.success)        return true
  if (err_msg === undefined) return false
  throw new Error(err_msg ?? 'object failed schema validation')
}
