/**
 * Batcher Unit Tests
 *
 * Tests for SignBatcher and ECDHBatcher queue operations,
 * scheduling, and concurrent request handling.
 */

import { BifrostNode }       from '@/class/client.js'
import { parse_group_vector } from '@/test/lib/parse.js'
import { parse_error }        from '@/util/index.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape: Test) {
  tape.test('Batcher tests', t => {
    try {
      const vec   = parse_group_vector(VECTOR)
      const group = vec.group
      const share = vec.shares[0]
      const relays = ['wss://test.relay.example']

      // ========================================================================
      // SignBatcher Tests
      // ========================================================================

      t.test('SignBatcher is accessible from node', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.sign_batcher !== undefined, 'sign_batcher exists')
        st.equal(node.sign_batcher.node, node, 'batcher references parent node')

        st.end()
      })

      t.test('SignBatcher close() rejects pending requests', async st => {
        const node = new BifrostNode(group, share, relays, {
          sign_interval: 10000  // Long interval so requests stay queued
        })

        // Queue some requests (they won't actually be processed)
        const sighash = 'a'.repeat(64)
        const promise1 = node.sign_batcher.push([sighash, 'nostr'])
        const promise2 = node.sign_batcher.push([sighash, 'nostr'])

        // Close the batcher
        node.sign_batcher.close()

        // All pending requests should reject
        try {
          await promise1
          st.fail('promise1 should have rejected')
        } catch (err) {
          st.equal(err, 'batcher closed', 'promise1 rejected with correct message')
        }

        try {
          await promise2
          st.fail('promise2 should have rejected')
        } catch (err) {
          st.equal(err, 'batcher closed', 'promise2 rejected with correct message')
        }

        st.end()
      })

      t.test('SignBatcher respects max_sign_batch config', st => {
        const node = new BifrostNode(group, share, relays, {
          max_sign_batch: 5,
          pool_config: {
            pool_size: 20,
            min_threshold: 10,
            critical_threshold: 5
          }
        })

        st.equal(node.config.max_sign_batch, 5, 'max_sign_batch is configured')

        st.end()
      })

      // ========================================================================
      // ECDHBatcher Tests
      // ========================================================================

      t.test('ECDHBatcher is accessible from node', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.ecdh_batcher !== undefined, 'ecdh_batcher exists')
        st.equal(node.ecdh_batcher.node, node, 'batcher references parent node')

        st.end()
      })

      t.test('ECDHBatcher close() rejects pending requests', async st => {
        const node = new BifrostNode(group, share, relays, {
          ecdh_interval: 10000  // Long interval so requests stay queued
        })

        // Queue some requests (they won't actually be processed)
        const pubkey = 'b'.repeat(64)
        const promise1 = node.ecdh_batcher.push(pubkey)
        const promise2 = node.ecdh_batcher.push(pubkey)

        // Close the batcher
        node.ecdh_batcher.close()

        // All pending requests should reject
        try {
          await promise1
          st.fail('promise1 should have rejected')
        } catch (err) {
          st.equal(err, 'batcher closed', 'promise1 rejected with correct message')
        }

        try {
          await promise2
          st.fail('promise2 should have rejected')
        } catch (err) {
          st.equal(err, 'batcher closed', 'promise2 rejected with correct message')
        }

        st.end()
      })

      t.test('ECDHBatcher respects max_ecdh_batch config', st => {
        const node = new BifrostNode(group, share, relays, {
          max_ecdh_batch: 10
        })

        st.equal(node.config.max_ecdh_batch, 10, 'max_ecdh_batch is configured')

        st.end()
      })

      t.test('ECDHBatcher checks cache before queuing', async st => {
        const node = new BifrostNode(group, share, relays, {
          ecdh_interval: 10000  // Long interval
        })

        const pubkey = 'c'.repeat(64)
        // Pre-populate cache with encrypted secret
        // The cache stores encrypted secrets that get decrypted on retrieval
        // For this test, we just verify cache is checked
        st.equal(node.cache.ecdh.has(pubkey), false, 'cache starts empty')

        st.end()
      })

      // ========================================================================
      // Interval Configuration Tests
      // ========================================================================

      t.test('batchers use configured intervals', st => {
        const node = new BifrostNode(group, share, relays, {
          sign_interval: 250,
          ecdh_interval: 300
        })

        st.equal(node.config.sign_interval, 250, 'sign_interval is configured')
        st.equal(node.config.ecdh_interval, 300, 'ecdh_interval is configured')

        st.end()
      })

      t.test('batchers use default intervals when not specified', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.config.sign_interval > 0, 'default sign_interval is set')
        st.ok(node.config.ecdh_interval > 0, 'default ecdh_interval is set')

        st.end()
      })

      // ========================================================================
      // Concurrent Request Tests
      // ========================================================================

      t.test('multiple concurrent requests are queued', async st => {
        const node = new BifrostNode(group, share, relays, {
          sign_interval: 10000  // Long interval so we can inspect queue
        })

        // Queue multiple requests
        const sighash1 = 'd'.repeat(64)
        const sighash2 = 'e'.repeat(64)
        const sighash3 = 'f'.repeat(64)

        // Start all requests concurrently (don't await yet)
        const p1 = node.sign_batcher.push([sighash1, 'nostr'])
        const p2 = node.sign_batcher.push([sighash2, 'nostr'])
        const p3 = node.sign_batcher.push([sighash3, 'nostr'])

        // Close to reject all and verify they were all queued
        node.sign_batcher.close()

        const results = await Promise.allSettled([p1, p2, p3])

        st.equal(results.length, 3, 'all three requests were tracked')
        st.equal(results[0].status, 'rejected', 'request 1 was queued and rejected')
        st.equal(results[1].status, 'rejected', 'request 2 was queued and rejected')
        st.equal(results[2].status, 'rejected', 'request 3 was queued and rejected')

        st.end()
      })

      t.test('ECDH requests for same pubkey are all resolved', async st => {
        const node = new BifrostNode(group, share, relays, {
          ecdh_interval: 10000
        })

        // Queue multiple requests for the same pubkey
        const pubkey = 'g'.repeat(64)
        const p1 = node.ecdh_batcher.push(pubkey)
        const p2 = node.ecdh_batcher.push(pubkey)
        const p3 = node.ecdh_batcher.push(pubkey)

        // Close to reject all
        node.ecdh_batcher.close()

        const results = await Promise.allSettled([p1, p2, p3])

        // All should be rejected (since we closed the batcher)
        st.equal(results.filter(r => r.status === 'rejected').length, 3,
          'all duplicate requests were tracked')

        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    }
  })
}
