import { z } from 'zod'

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

  export function error (err : unknown) : string {
    if (err instanceof Error)    return err.message
    if (typeof err === 'string') return err
    return String(err)
  }

  export function data <S extends z.ZodTypeAny> (
    data     : unknown,
    schema   : S,
  ) : z.SafeParseReturnType<unknown, z.infer<S>> {
    return schema.safeParse(data)
  }

  export function array <S extends z.ZodTypeAny> (
    data     : unknown[],
    schema   : S,
  ) : ParsedArrayResponse<z.infer<S>> {
    const parsed = data.map(e => schema.safeParse(e))
    const errors = parsed
        .filter(e => !e.success)
        .map(e => e.error.errors.map(x => `${x.message}: ${x.path}`))
    return (errors.length !== 0)
      ? { ok: false, errors }
      : { ok: true, data: parsed.map(e => e.data) }
  }
}
