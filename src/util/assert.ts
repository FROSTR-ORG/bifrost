/**
 * Assertion utilities for runtime validation.
 *
 * These functions throw descriptive errors when assertions fail,
 * and use TypeScript's `asserts` keyword for type narrowing.
 *
 * @module
 */

import { Buff, Bytes }     from '@vbyte/buff'
import { ZodSchema }       from 'zod'
import { validate_schema } from './helpers.js'

export namespace Assert {
  /**
   * Asserts that a value is truthy (boolean true).
   *
   * @param value - The value to check (must be a boolean).
   * @param message - Optional error message if assertion fails.
   * @throws TypeError if value is not a boolean.
   * @throws Error if value is false.
   *
   * @example
   * ```typescript
   * Assert.ok(user !== null, 'user must exist')
   * Assert.ok(count > 0, 'count must be positive')
   * ```
   */
  export function ok (value : unknown, message ?: string) : asserts value {
    if (typeof value !== 'boolean') {
      throw new TypeError('Assert.ok() requires a boolean value')
    }
    if (value === false) throw new Error(message ?? 'Assertion failed!')
  }

  /**
   * Asserts that two values are strictly equal (===).
   *
   * @param actual - The actual value to check.
   * @param expected - The expected value.
   * @param err_msg - Optional error message if values differ.
   * @throws Error if actual !== expected.
   *
   * @example
   * ```typescript
   * Assert.equal(result.length, 32, 'hash must be 32 bytes')
   * Assert.equal(status, 'ok')
   * ```
   */
  export function equal <T> (
    actual   : T,
    expected : T,
    err_msg ?: string
  ) : asserts expected {
    if (actual !== expected) throw new Error(err_msg ?? `${actual} !== ${expected}`)
  }

  /**
   * Asserts that a value is neither null nor undefined.
   *
   * After this assertion, TypeScript narrows the type to NonNullable<T>.
   *
   * @param input - The value to check.
   * @param err_msg - Optional error message if value is null/undefined.
   * @throws TypeError if input is undefined or null.
   *
   * @example
   * ```typescript
   * Assert.exists(user, 'user not found')
   * // TypeScript now knows user is not null/undefined
   * console.log(user.name)
   * ```
   */
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

  /**
   * Asserts that a byte array has a specific size.
   *
   * @param input - The byte array to check (Uint8Array, Buffer, or hex string).
   * @param size - The expected byte length.
   * @param err_msg - Optional error message if size doesn't match.
   * @returns True if size matches (for compatibility).
   * @throws Error if the byte length doesn't match expected size.
   *
   * @example
   * ```typescript
   * Assert.size(pubkey, 32, 'pubkey must be 32 bytes')
   * Assert.size(signature, 64, 'signature must be 64 bytes')
   * ```
   */
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

  /**
   * Asserts that a value conforms to a Zod schema.
   *
   * First checks that the value exists (not null/undefined),
   * then validates against the provided Zod schema.
   *
   * @param schema - The Zod schema to validate against.
   * @param input - The value to validate.
   * @param err_msg - Optional error message prefix if validation fails.
   * @throws TypeError if input is null or undefined.
   * @throws Error if input doesn't match the schema.
   *
   * @example
   * ```typescript
   * const userSchema = z.object({ name: z.string(), age: z.number() })
   * Assert.schema(userSchema, data, 'invalid user data')
   * ```
   */
  export function schema <T> (
    schema   : ZodSchema,
    input   ?: T | null,
    err_msg ?: string
  ) : asserts input is NonNullable<T> {
    exists(input)
    validate_schema(input, schema, err_msg ?? null)
  }

  /**
   * Asserts that a value is a valid hex string.
   *
   * Checks that the value is:
   * - A string type
   * - Contains only hex characters (0-9, a-f, A-F)
   * - Has even length (each byte is 2 hex chars)
   *
   * @param input - The value to check.
   * @throws Error if input is not a valid hex string.
   *
   * @example
   * ```typescript
   * Assert.is_hex(pubkey)
   * Assert.is_hex(signature)
   * ```
   */
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
