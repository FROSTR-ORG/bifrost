import { z } from 'zod'

export const now   = () => Math.floor(Date.now() / 1000)
export const sleep = (ms : number = 1000) => new Promise(res => setTimeout(res, ms))

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
