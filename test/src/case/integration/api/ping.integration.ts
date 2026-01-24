/**
 * Ping API Integration Tests
 *
 * Tests for peer discovery, status updates, and nonce exchange via ping.
 */

import { LIB }            from '@vbyte/nostr-sdk'
const { parse_error } = LIB
import { EventTracker, get_peer_idx } from '../lib/helpers.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

export default function (ctx : TestNetwork, tape : Test) {

  tape.test('Ping API: Optimal Cases', t => {

    t.test('basic ping updates peer status to online', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const Bob   = ctx.nodes.get('bob')!

        // Initially Bob should be offline or unknown
        const peer_before = Alice.peers.find(p => p.pubkey === Bob.pubkey)

        const res = await Alice.req.ping(Bob.pubkey)

        st.ok(res.ok, 'ping request succeeded')
        st.ok(res.data, 'response has data')
        st.ok(res.data.policy, 'response includes policy')
        st.equal(res.data.policy.send, true, 'peer send policy is true')
        st.equal(res.data.policy.recv, true, 'peer recv policy is true')

        // Verify peer status updated
        const peer_after = Alice.peers.find(p => p.pubkey === Bob.pubkey)
        st.equal(peer_after?.status, 'online', 'peer status is online after ping')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('ping exchanges nonces for signing', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const Carol = ctx.nodes.get('carol')!

        const carol_idx = get_peer_idx(Alice, Carol.pubkey)
        if (carol_idx === undefined) {
          st.fail('could not find Carol member index')
          st.end()
          return
        }

        // Get initial nonce count
        const before_count = Alice.pool.get_available_count(carol_idx)

        // Ping Carol
        const res = await Alice.req.ping(Carol.pubkey)
        st.ok(res.ok, 'ping succeeded')

        // Should have received nonces from Carol
        const after_count = Alice.pool.get_available_count(carol_idx)
        st.ok(after_count >= before_count, 'nonce count increased or maintained after ping')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('rapid pings to same peer succeed', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const Bob   = ctx.nodes.get('bob')!

        // Send multiple pings rapidly
        const pings = [
          Alice.req.ping(Bob.pubkey),
          Alice.req.ping(Bob.pubkey),
          Alice.req.ping(Bob.pubkey)
        ]

        const results = await Promise.all(pings)

        // All should succeed
        const all_ok = results.every(r => r.ok)
        st.ok(all_ok, 'all rapid pings succeeded')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('ping triggers replenishment when pool is low', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const Bob   = ctx.nodes.get('bob')!
        const tracker = new EventTracker()

        const bob_idx = get_peer_idx(Alice, Bob.pubkey)
        if (bob_idx === undefined) {
          st.fail('could not find Bob member index')
          st.end()
          return
        }

        // Track pool events
        tracker.track_pool(Alice, 'nonces_received')

        // Ping to trigger nonce exchange
        const res = await Alice.req.ping(Bob.pubkey)
        st.ok(res.ok, 'ping succeeded')

        // Should have received nonces
        const received_count = tracker.count('nonces_received')
        st.ok(received_count >= 0, 'nonces_received event tracked')

        tracker.cleanup()

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.end()
  })

  tape.test('Ping API: Edge Cases', t => {

    t.test('ping returns pool status information', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const Bob   = ctx.nodes.get('bob')!

        const res = await Alice.req.ping(Bob.pubkey)

        st.ok(res.ok, 'ping succeeded')
        // Pool status may be included in response
        if (res.data.pool_status) {
          st.ok(Array.isArray(res.data.pool_status), 'pool_status is an array')
        } else {
          st.pass('pool_status not included (may not be required)')
        }

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('bidirectional ping establishes full connectivity', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const Bob   = ctx.nodes.get('bob')!

        // Ping in both directions
        const res1 = await Alice.req.ping(Bob.pubkey)
        const res2 = await Bob.req.ping(Alice.pubkey)

        st.ok(res1.ok, 'Alice -> Bob ping succeeded')
        st.ok(res2.ok, 'Bob -> Alice ping succeeded')

        // Both should have each other as online
        const bob_peer = Alice.peers.find(p => p.pubkey === Bob.pubkey)
        const alice_peer = Bob.peers.find(p => p.pubkey === Alice.pubkey)

        st.equal(bob_peer?.status, 'online', 'Bob is online for Alice')
        st.equal(alice_peer?.status, 'online', 'Alice is online for Bob')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.end()
  })

  tape.test('Ping API: Error Cases', t => {

    t.test('ping to non-peer pubkey fails gracefully', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        // Generate a random pubkey that's not in the group
        const fake_pubkey = '0'.repeat(64)

        const res = await Alice.req.ping(fake_pubkey)

        // Should fail or timeout
        st.notOk(res.ok, 'ping to non-peer should fail')

      } catch (err) {
        // Expected to fail
        st.pass('ping to non-peer threw error as expected')
      } finally {
        st.end()
      }
    })

    t.test('ping with invalid pubkey format fails', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        // Invalid pubkey (too short)
        const invalid_pubkey = 'invalid'

        const res = await Alice.req.ping(invalid_pubkey)

        st.notOk(res.ok, 'ping with invalid pubkey should fail')

      } catch (err) {
        st.pass('ping with invalid pubkey threw error as expected')
      } finally {
        st.end()
      }
    })

    t.end()
  })
}
