/**
 * NoncePool Unit Tests
 *
 * Tests for nonce pool configuration validation.
 */

import { Buff }        from '@vbyte/buff'
import { parse_error } from '@/util/index.js'
import { NoncePool }   from '@/class/pool.js'

import type { Test } from 'tape'

export default function (tape : Test) {

  tape.test('NoncePool: Config Validation', t => {

    t.test('accepts valid default config', st => {
      try {
        const seckey = Buff.random(32).hex
        const pool = new NoncePool(1, seckey)

        st.ok(pool.config.pool_size === 100, 'default pool_size is 100')
        st.ok(pool.config.min_threshold === 20, 'default min_threshold is 20')
        st.ok(pool.config.critical_threshold === 5, 'default critical_threshold is 5')
        st.ok(pool.config.replenish_count === 50, 'default replenish_count is 50')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })

    t.test('accepts valid partial config override', st => {
      try {
        const seckey = Buff.random(32).hex
        const pool = new NoncePool(1, seckey, { pool_size: 200 })

        st.ok(pool.config.pool_size === 200, 'pool_size overridden to 200')
        st.ok(pool.config.min_threshold === 20, 'min_threshold unchanged')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })

    t.test('rejects invalid partial config: min_threshold > pool_size', st => {
      try {
        const seckey = Buff.random(32).hex
        // This should fail: default pool_size is 100, but min_threshold is 200
        new NoncePool(1, seckey, { min_threshold: 200 })
        st.fail('expected error for min_threshold > pool_size')
      } catch (err) {
        st.ok(err instanceof Error, 'throws an Error')
        st.ok((err as Error).message.includes('Invalid pool config'), 'error message indicates invalid config')
        st.ok((err as Error).message.includes('min_threshold'), 'error message mentions min_threshold')
      }
      st.end()
    })

    t.test('rejects invalid partial config: critical_threshold >= min_threshold', st => {
      try {
        const seckey = Buff.random(32).hex
        // This should fail: critical_threshold >= min_threshold
        new NoncePool(1, seckey, { critical_threshold: 25 })
        st.fail('expected error for critical_threshold >= min_threshold')
      } catch (err) {
        st.ok(err instanceof Error, 'throws an Error')
        st.ok((err as Error).message.includes('Invalid pool config'), 'error message indicates invalid config')
        st.ok((err as Error).message.includes('critical_threshold'), 'error message mentions critical_threshold')
      }
      st.end()
    })

    t.test('accepts valid complete config override', st => {
      try {
        const seckey = Buff.random(32).hex
        const pool = new NoncePool(1, seckey, {
          pool_size: 500,
          min_threshold: 100,
          critical_threshold: 20,
          replenish_count: 200
        })

        st.ok(pool.config.pool_size === 500, 'pool_size is 500')
        st.ok(pool.config.min_threshold === 100, 'min_threshold is 100')
        st.ok(pool.config.critical_threshold === 20, 'critical_threshold is 20')
        st.ok(pool.config.replenish_count === 200, 'replenish_count is 200')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })
  })
}
