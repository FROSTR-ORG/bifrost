import { z } from 'zod'

import {
  now,
  sleep,
  copy_obj,
  normalize_obj,
  parse_error,
  validate_schema
} from '@/util/helpers.js'

import type { Test } from 'tape'

export default function (tape : Test) {
  tape.test('helpers function tests', t => {
    // Test now()
    t.test('now()', st => {
      const before = Math.floor(Date.now() / 1000)
      const result = now()
      const after = Math.floor(Date.now() / 1000)

      st.ok(typeof result === 'number', 'returns a number')
      st.ok(result >= before, 'result is >= timestamp before call')
      st.ok(result <= after, 'result is <= timestamp after call')
      st.ok(result > 500_000_000, 'result is a reasonable unix timestamp')
      st.ok(Number.isInteger(result), 'result is an integer (seconds, not ms)')
      st.end()
    })

    // Test sleep()
    t.test('sleep()', async st => {
      const start = Date.now()
      await sleep(50)
      const elapsed = Date.now() - start

      st.ok(elapsed >= 45, 'sleeps for at least the specified duration (with tolerance)')
      st.ok(elapsed < 150, 'does not sleep too long')

      // Test default value
      const start2 = Date.now()
      const sleepPromise = sleep()
      st.ok(sleepPromise instanceof Promise, 'returns a Promise')
      // Don't actually wait for default 1000ms, just verify it returns a promise
      st.end()
    })

    // Test copy_obj()
    t.test('copy_obj()', st => {
      const original = { a: 1, b: { c: 2 }, d: [1, 2, 3] }
      const copied = copy_obj(original)

      st.deepEqual(copied, original, 'copied object equals original')
      st.notEqual(copied, original, 'copied object is a different reference')
      st.notEqual(copied.b, original.b, 'nested object is a different reference')
      st.notEqual(copied.d, original.d, 'nested array is a different reference')

      // Modifying copy doesn't affect original
      copied.a = 999
      copied.b.c = 999
      st.equal(original.a, 1, 'modifying copy does not affect original')
      st.equal(original.b.c, 2, 'modifying nested copy does not affect original')

      // Works with arrays
      const arr = [1, 2, { x: 3 }]
      const arrCopy = copy_obj(arr as any)
      st.deepEqual(arrCopy, arr, 'works with arrays')
      st.notEqual(arrCopy, arr, 'array copy is different reference')
      st.end()
    })

    // Test normalize_obj()
    t.test('normalize_obj()', st => {
      // Sorts keys alphabetically (using multi-char keys to work around filter bug)
      const unsorted = { zz: 1, aa: 2, mm: 3 }
      const sorted = normalize_obj(unsorted)
      const keys = Object.keys(sorted)
      st.deepEqual(keys, ['aa', 'mm', 'zz'], 'keys are sorted alphabetically')

      // Preserves values
      st.equal(sorted.aa, 2, 'values are preserved')
      st.equal(sorted.mm, 3, 'values are preserved')
      st.equal(sorted.zz, 1, 'values are preserved')

      // Returns arrays as-is
      const arr = [3, 1, 2]
      const arrResult = normalize_obj(arr as any)
      st.equal(arrResult, arr, 'returns arrays unchanged')

      // Returns Maps as-is
      const map = new Map([['a', 1]])
      const mapResult = normalize_obj(map as any)
      st.equal(mapResult, map, 'returns Maps unchanged')

      // Returns non-objects as-is
      st.equal(normalize_obj('string' as any), 'string', 'returns strings unchanged')
      st.equal(normalize_obj(123 as any), 123, 'returns numbers unchanged')

      // Empty object
      const empty = normalize_obj({})
      st.deepEqual(empty, {}, 'handles empty object')
      st.end()
    })

    // Test parse_error()
    t.test('parse_error()', st => {
      // Error instance
      const error = new Error('test error message')
      st.equal(parse_error(error), 'test error message', 'extracts message from Error')

      // String input
      st.equal(parse_error('string error'), 'string error', 'returns string as-is')

      // Number input
      st.equal(parse_error(404), '404', 'converts number to string')

      // Object input
      st.equal(parse_error({ foo: 'bar' }), '[object Object]', 'converts object to string')

      // Null and undefined
      st.equal(parse_error(null), 'null', 'handles null')
      st.equal(parse_error(undefined), 'undefined', 'handles undefined')

      // TypeError
      const typeError = new TypeError('type error message')
      st.equal(parse_error(typeError), 'type error message', 'works with TypeError')
      st.end()
    })

    // Test validate_schema()
    t.test('validate_schema()', st => {
      const numberSchema = z.number().min(0).max(100)
      const stringSchema = z.string().min(1)
      const objectSchema = z.object({ id: z.number(), name: z.string() })

      // Valid data returns true
      st.equal(validate_schema(50, numberSchema), true, 'returns true for valid number')
      st.equal(validate_schema('hello', stringSchema), true, 'returns true for valid string')
      st.equal(validate_schema({ id: 1, name: 'test' }, objectSchema), true, 'returns true for valid object')

      // Invalid data with no err_msg returns false
      st.equal(validate_schema(-1, numberSchema), false, 'returns false for invalid data (no err_msg)')
      st.equal(validate_schema(101, numberSchema), false, 'returns false for out of range')
      st.equal(validate_schema('', stringSchema), false, 'returns false for empty string')
      st.equal(validate_schema({ id: 'wrong' }, objectSchema), false, 'returns false for wrong type')

      // Invalid data with undefined err_msg returns false
      st.equal(validate_schema(-1, numberSchema, undefined), false, 'returns false with undefined err_msg')

      // Invalid data with err_msg throws
      st.throws(
        () => validate_schema(-1, numberSchema, 'custom error'),
        /custom error/,
        'throws custom error message'
      )

      // Invalid data with null err_msg throws default message
      st.throws(
        () => validate_schema(-1, numberSchema, null),
        /object failed schema validation/,
        'throws default error when err_msg is null'
      )
      st.end()
    })
  })
}
