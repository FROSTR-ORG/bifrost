import { Assert }      from '@/util/assert.js'
import { parse_error } from '@frostr/bifrost/util'
import { Buff }        from '@vbyte/buff'
import { z }           from 'zod'

import type { Test } from 'tape'

export default function (tape : Test) {
  tape.test('Assert namespace tests', t => {
    try {
      // Test Assert.ok
      t.test('Assert.ok()', st => {
        // Should not throw for boolean true
        st.doesNotThrow(() => Assert.ok(true), 'does not throw for true')

        // Should throw for false
        st.throws(() => Assert.ok(false), /Assertion failed/, 'throws for false')
        st.throws(() => Assert.ok(false, 'custom message'), /custom message/, 'throws with custom message')

        // Should throw TypeError for non-boolean values
        st.throws(() => Assert.ok(1), /Assert\.ok\(\) requires a boolean value/, 'throws TypeError for 1')
        st.throws(() => Assert.ok('string'), /Assert\.ok\(\) requires a boolean value/, 'throws TypeError for non-empty string')
        st.throws(() => Assert.ok({}), /Assert\.ok\(\) requires a boolean value/, 'throws TypeError for object')
        st.throws(() => Assert.ok([]), /Assert\.ok\(\) requires a boolean value/, 'throws TypeError for array')
        st.throws(() => Assert.ok(0), /Assert\.ok\(\) requires a boolean value/, 'throws TypeError for 0')
        st.throws(() => Assert.ok(''), /Assert\.ok\(\) requires a boolean value/, 'throws TypeError for empty string')
        st.throws(() => Assert.ok(null), /Assert\.ok\(\) requires a boolean value/, 'throws TypeError for null')
        st.throws(() => Assert.ok(undefined), /Assert\.ok\(\) requires a boolean value/, 'throws TypeError for undefined')
        st.end()
      })

      // Test Assert.equal
      t.test('Assert.equal()', st => {
        // Should not throw for equal values
        st.doesNotThrow(() => Assert.equal(1, 1), 'does not throw for equal numbers')
        st.doesNotThrow(() => Assert.equal('a', 'a'), 'does not throw for equal strings')
        st.doesNotThrow(() => Assert.equal(true, true), 'does not throw for equal booleans')
        st.doesNotThrow(() => Assert.equal(null, null), 'does not throw for null === null')

        // Should throw for unequal values
        st.throws(() => Assert.equal(1, 2), /1 !== 2/, 'throws for unequal numbers')
        st.throws(() => Assert.equal('a', 'b'), /a !== b/, 'throws for unequal strings')
        st.throws(() => Assert.equal(1, 2, 'custom error'), /custom error/, 'throws with custom message')

        // Reference equality (not deep equality)
        const obj1 = { a: 1 }
        const obj2 = { a: 1 }
        st.throws(() => Assert.equal(obj1, obj2), 'throws for different object references')
        st.doesNotThrow(() => Assert.equal(obj1, obj1), 'does not throw for same reference')
        st.end()
      })

      // Test Assert.exists
      t.test('Assert.exists()', st => {
        // Should not throw for existing values
        st.doesNotThrow(() => Assert.exists(0), 'does not throw for 0')
        st.doesNotThrow(() => Assert.exists(''), 'does not throw for empty string')
        st.doesNotThrow(() => Assert.exists(false), 'does not throw for false')
        st.doesNotThrow(() => Assert.exists({}), 'does not throw for object')

        // Should throw for undefined
        st.throws(() => Assert.exists(undefined), /Input is undefined/, 'throws for undefined')
        st.throws(() => Assert.exists(undefined, 'custom'), /custom/, 'throws with custom message for undefined')

        // Should throw for null
        st.throws(() => Assert.exists(null), /Input is null/, 'throws for null')
        st.throws(() => Assert.exists(null, 'custom null'), /custom null/, 'throws with custom message for null')
        st.end()
      })

      // Test Assert.size
      t.test('Assert.size()', st => {
        // Should return true for correct size
        const bytes32 = Buff.random(32)
        st.equal(Assert.size(bytes32, 32), true, 'returns true for correct size')

        // Should work with hex strings
        const hex32 = 'a'.repeat(64)  // 32 bytes as hex
        st.equal(Assert.size(hex32, 32), true, 'works with hex strings')

        // Should throw for incorrect size
        st.throws(() => Assert.size(bytes32, 16), /Invalid byte size/, 'throws for wrong size')
        st.throws(() => Assert.size(bytes32, 16, 'size error'), /size error/, 'throws with custom message')

        // Edge cases
        st.equal(Assert.size(new Uint8Array(0), 0), true, 'works for empty array')
        st.equal(Assert.size('', 0), true, 'works for empty hex string')
        st.end()
      })

      // Test Assert.schema
      t.test('Assert.schema()', st => {
        const numberSchema = z.number()
        const objectSchema = z.object({ name: z.string() })

        // Should not throw for valid data
        st.doesNotThrow(() => Assert.schema(numberSchema, 42), 'does not throw for valid number')
        st.doesNotThrow(() => Assert.schema(objectSchema, { name: 'test' }), 'does not throw for valid object')

        // Should throw for null/undefined (from Assert.exists)
        st.throws(() => Assert.schema(numberSchema, null), /Input is null/, 'throws for null')
        st.throws(() => Assert.schema(numberSchema, undefined), /Input is undefined/, 'throws for undefined')

        // Should throw for invalid schema (validate_schema returns false when no err_msg)
        // Note: Assert.schema passes null as err_msg, so it throws the default message
        st.throws(() => Assert.schema(numberSchema, 'not a number'), /object failed schema validation/, 'throws for invalid data')
        st.throws(() => Assert.schema(objectSchema, { name: 123 }, 'custom schema error'), /custom schema error/, 'throws with custom message')
        st.end()
      })

      // Test Assert.is_hex
      t.test('Assert.is_hex()', st => {
        // Should not throw for valid hex
        st.doesNotThrow(() => Assert.is_hex('abcdef'), 'does not throw for lowercase hex')
        st.doesNotThrow(() => Assert.is_hex('ABCDEF'), 'does not throw for uppercase hex')
        st.doesNotThrow(() => Assert.is_hex('AbCdEf'), 'does not throw for mixed case hex')
        st.doesNotThrow(() => Assert.is_hex('0123456789'), 'does not throw for numeric hex')
        st.doesNotThrow(() => Assert.is_hex(''), 'does not throw for empty string')
        st.doesNotThrow(() => Assert.is_hex('00'), 'does not throw for 00')

        // Should throw for invalid hex
        st.throws(() => Assert.is_hex('xyz'), /invalid hex/, 'throws for non-hex characters')
        st.throws(() => Assert.is_hex('abc'), /invalid hex/, 'throws for odd-length hex')
        st.throws(() => Assert.is_hex('gh'), /invalid hex/, 'throws for invalid hex chars')
        st.throws(() => Assert.is_hex(123), /invalid hex/, 'throws for non-string')
        st.throws(() => Assert.is_hex(null), /invalid hex/, 'throws for null')
        st.throws(() => Assert.is_hex(undefined), /invalid hex/, 'throws for undefined')
        st.throws(() => Assert.is_hex('ab cd'), /invalid hex/, 'throws for hex with spaces')
        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}
