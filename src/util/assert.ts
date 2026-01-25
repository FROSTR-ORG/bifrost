import { Buff, Bytes }     from '@vbyte/buff'
import { ZodSchema }       from 'zod'
import { validate_schema } from './helpers.js'

export namespace Assert {
  export function ok (value : unknown, message ?: string) : asserts value {
    if (typeof value !== 'boolean') {
      throw new TypeError('Assert.ok() requires a boolean value')
    }
    if (value === false) throw new Error(message ?? 'Assertion failed!')
  }

  export function equal <T> (
    actual   : T,
    expected : T,
    err_msg ?: string
  ) : asserts expected {
    if (actual !== expected) throw new Error(err_msg ?? `${actual} !== ${expected}`)
  }

  export function exists <T> (
    input   ?: T | null,
    err_msg ?: string
  ) : asserts input is NonNullable<T> {
    if (typeof input === 'undefined') {
      throw new TypeError(err_msg ?? 'Input is undefined!')
    }
    if (input === null) {
      throw new TypeError(err_msg ?? 'Input is null!')
    }
  }

  export function size (
    input    : Bytes,
    size     : number,
    err_msg ?: string
  ) : boolean {
    const bytes = Buff.bytes(input)
    if (bytes.length !== size) {
      // Don't leak actual data in error message
      throw new Error(err_msg ?? `Invalid byte size: expected ${size}, got ${bytes.length}`)
    }
    return true
  }

  export function schema <T> (
    schema   : ZodSchema,
    input   ?: T | null,
    err_msg ?: string
  ) : asserts input is NonNullable<T> {
    exists(input)
    validate_schema(input, schema, err_msg ?? null)
  }

  export function is_hex (
    input : unknown
  ) : asserts input is string {
    if (typeof input !== 'string') {
      throw new Error('invalid hex: expected string')
    }
    if (input.match(/[^a-fA-F0-9]/) !== null) {
      throw new Error('invalid hex: contains non-hex characters')
    }
    if (input.length % 2 !== 0) {
      throw new Error('invalid hex: odd length')
    }
  }
}
