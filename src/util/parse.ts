import { z } from 'zod'
import { parse_error } from './helpers.js'

type ParsedArrayResponse<T> = ParsedArraySuccess<T> | ParsedArrayError

interface ParsedArraySuccess <T> {
  ok   : true
  data : T[]
}

interface ParsedArrayError {
  ok     :false
  errors : string[][]
}

export namespace Parse {

  /**
   * Parse an error into a string message.
   * Re-exports parse_error from helpers for namespace consistency.
   */
  export const error = parse_error

  export function data <S extends z.ZodTypeAny> (
    data     : unknown,
    schema   : S,
  ) : { success: true; data: z.infer<S> } | { success: false; error: z.ZodError } {
    return schema.safeParse(data)
  }

  export function array <S extends z.ZodTypeAny> (
    data     : unknown[],
    schema   : S,
  ) : ParsedArrayResponse<z.infer<S>> {
    const parsed = data.map(item => schema.safeParse(item))
    const errors : string[][] = []
    const results : z.infer<S>[] = []
    for (const result of parsed) {
      if (result.success) {
        results.push(result.data)
      } else {
        errors.push(result.error.issues.map(issue => `${issue.message}: ${issue.path}`))
      }
    }
    return (errors.length !== 0)
      ? { ok: false, errors }
      : { ok: true, data: results }
  }
}
