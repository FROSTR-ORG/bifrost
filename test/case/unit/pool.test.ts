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

  tape.test('NoncePool: Exhaustion and Bounds', t => {

    t.test('consume_incoming returns null when pool is empty', st => {
      try {
        const seckey = Buff.random(32).hex
        const pool = new NoncePool(1, seckey)
        const peer_idx = 2

        // Try to consume without any nonces
        const result = pool.consume_incoming(peer_idx)
        st.equal(result, null, 'returns null when no nonces available')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })

    t.test('generate_for_peer respects pool_size limit', st => {
      try {
        const seckey = Buff.random(32).hex
        const pool = new NoncePool(1, seckey, {
          pool_size: 10,
          min_threshold: 3,
          critical_threshold: 1,
          replenish_count: 5
        })
        const peer_idx = 2

        // Generate up to pool_size
        const nonces1 = pool.generate_for_peer(peer_idx, 7)
        st.equal(nonces1.length, 7, 'generated 7 nonces')
        st.equal(pool.get_outgoing_count(peer_idx), 7, 'outgoing count is 7')

        // Try to generate more than remaining capacity
        const nonces2 = pool.generate_for_peer(peer_idx, 10)
        st.equal(nonces2.length, 3, 'only generated 3 more (pool_size limit)')
        st.equal(pool.get_outgoing_count(peer_idx), 10, 'outgoing count is 10')

        // No more slots available
        const nonces3 = pool.generate_for_peer(peer_idx)
        st.equal(nonces3.length, 0, 'returns empty when pool is full')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })

    t.test('can_sign returns false when below critical threshold', st => {
      try {
        const seckey = Buff.random(32).hex
        const pool = new NoncePool(1, seckey, {
          pool_size: 100,
          min_threshold: 10,
          critical_threshold: 5,
          replenish_count: 20
        })
        const peer_idx = 2

        // No nonces - cannot sign
        st.equal(pool.can_sign(peer_idx), false, 'cannot sign with empty pool')

        // Store some nonces (at critical threshold)
        const nonces = [{
          binder_pn: '02' + 'a'.repeat(64),
          hidden_pn: '02' + 'b'.repeat(64),
          code: Buff.random(32).hex
        }]
        pool.store_incoming(peer_idx, nonces)
        st.equal(pool.can_sign(peer_idx), false, 'cannot sign at critical threshold')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })
  })

  tape.test('NoncePool: Destroy', t => {

    t.test('destroy() clears secrets and prevents further operations', st => {
      try {
        const seckey = Buff.random(32).hex
        const pool = new NoncePool(1, seckey)
        const peer_idx = 2

        // Generate some nonces before destroy
        const nonces = pool.generate_for_peer(peer_idx, 5)
        st.equal(nonces.length, 5, 'generated nonces before destroy')
        st.equal(pool.destroyed, false, 'pool not destroyed yet')

        // Destroy the pool
        pool.destroy()
        st.equal(pool.destroyed, true, 'pool is now destroyed')

        // Operations should throw after destroy
        st.throws(
          () => pool.generate_for_peer(peer_idx, 1),
          /destroyed/,
          'generate_for_peer throws after destroy'
        )

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })
  })
}
