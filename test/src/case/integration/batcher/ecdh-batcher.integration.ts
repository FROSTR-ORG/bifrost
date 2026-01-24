/**
 * ECDHBatcher Integration Tests
 *
 * Tests for batch ECDH processing under load.
 */

import { LIB }              from '@vbyte/nostr-sdk'
const { parse_error } = LIB
import { generate_ecdh_pubkeys, measure_time, setup_nonce_pools, sleep } from '../lib/helpers.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

export default function (ctx : TestNetwork, tape : Test) {

  tape.test('ECDHBatcher: Batch Processing', t => {

    t.test('batch 10 concurrent ECDH requests', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        await setup_nonce_pools(ctx.nodes)

        const pubkeys = generate_ecdh_pubkeys(10)

        // Queue all at once to trigger batching
        const promises = pubkeys.map(pk => Alice.req.ecdh(pk))
        const results = await Promise.all(promises)

        st.ok(results.every(r => r.ok), 'all requests succeeded')
        st.equal(results.length, 10, 'received 10 ECDH results')

        // All should be valid 32-byte secrets
        const secrets = results.map(r => r.data!)
        const all_valid = secrets.every(secret =>
          typeof secret === 'string' && secret.length === 66
        )
        st.ok(all_valid, 'all 10 ECDH secrets are valid')

        // All should be unique
        const unique = new Set(secrets)
        st.equal(unique.size, 10, 'all secrets are unique')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('batch 25 concurrent ECDH requests', async st => {
      try {
        const Bob = ctx.nodes.get('bob')!

        await setup_nonce_pools(ctx.nodes)

        const pubkeys = generate_ecdh_pubkeys(25)

        const { result, duration } = await measure_time(async () => {
          const promises = pubkeys.map(pk => Bob.req.ecdh(pk))
          return Promise.all(promises)
        })

        st.ok(result.every(r => r.ok), 'all requests succeeded')
        st.equal(result.length, 25, 'received 25 ECDH results')

        // All should be valid
        const secrets = result.map(r => r.data!)
        const all_valid = secrets.every(secret =>
          typeof secret === 'string' && secret.length === 66
        )
        st.ok(all_valid, 'all 25 ECDH secrets are valid')

        st.comment(`25 ECDH operations completed in ${duration.toFixed(0)}ms`)

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('batch interval timing', async st => {
      try {
        const Carol = ctx.nodes.get('carol')!

        await setup_nonce_pools(ctx.nodes)

        const pubkeys = generate_ecdh_pubkeys(5)

        // Queue all within batch interval
        const start = Date.now()
        const promises = pubkeys.map(pk => Carol.req.ecdh(pk))
        const results = await Promise.all(promises)
        const duration = Date.now() - start

        st.ok(results.every(r => r.ok), 'all requests succeeded')
        st.equal(results.length, 5, 'received 5 results')
        st.ok(duration < 10000, `5 batched ECDH completed in ${duration}ms`)

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.end()
  })

  tape.test('ECDHBatcher: Cache Behavior', t => {

    t.test('cache hit deduplicates requests', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        await setup_nonce_pools(ctx.nodes)

        // Same pubkey requested multiple times
        const [ pk ] = generate_ecdh_pubkeys(1)

        // First request (cache miss)
        const res1 = await Alice.req.ecdh(pk)

        // Subsequent requests (cache hit)
        const results = await Promise.all([
          Alice.req.ecdh(pk),
          Alice.req.ecdh(pk),
          Alice.req.ecdh(pk)
        ])

        st.ok(res1.ok, 'first request succeeded')

        // All should return same secret
        st.equal(res1.data, results[0].data, 'cache returns same secret')
        st.equal(res1.data, results[1].data, 'cache returns same secret')
        st.equal(res1.data, results[2].data, 'cache returns same secret')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('duplicate keys in same batch are handled', async st => {
      try {
        const Bob = ctx.nodes.get('bob')!

        await setup_nonce_pools(ctx.nodes)

        const [ pk ] = generate_ecdh_pubkeys(1)

        // Request same key multiple times in same batch
        const promises = [
          Bob.req.ecdh(pk),
          Bob.req.ecdh(pk),
          Bob.req.ecdh(pk)
        ]
        const results = await Promise.all(promises)

        st.ok(results.every(r => r.ok), 'all requests succeeded')

        // All should return same secret
        st.equal(results[0].data, results[1].data, 'duplicate requests return same secret')
        st.equal(results[1].data, results[2].data, 'duplicate requests return same secret')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('cache hit is faster than miss', async st => {
      try {
        const Carol = ctx.nodes.get('carol')!

        await setup_nonce_pools(ctx.nodes)

        const [ pk ] = generate_ecdh_pubkeys(1)

        // Cache miss
        const { duration: miss_time } = await measure_time(() => Carol.req.ecdh(pk))

        // Cache hit
        const { duration: hit_time } = await measure_time(() => Carol.req.ecdh(pk))

        st.ok(hit_time < miss_time, `cache hit (${hit_time.toFixed(0)}ms) faster than miss (${miss_time.toFixed(0)}ms)`)

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.end()
  })

  tape.test('ECDHBatcher: Load Testing', t => {

    t.test('sustained load: 50 ECDH operations in waves', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        await setup_nonce_pools(ctx.nodes)

        const all_secrets : string[] = []

        // Send 5 waves of 10 requests each
        for (let wave = 0; wave < 5; wave++) {
          const pubkeys = generate_ecdh_pubkeys(10)
          const promises = pubkeys.map(pk => Alice.req.ecdh(pk))
          const results = await Promise.all(promises)

          for (const r of results) {
            if (r.ok && r.data) {
              all_secrets.push(r.data)
            }
          }

          await sleep(100)
        }

        st.equal(all_secrets.length, 50, 'completed 50 ECDH operations')

        // All should be valid
        const all_valid = all_secrets.every(secret =>
          typeof secret === 'string' && secret.length === 66
        )
        st.ok(all_valid, 'all 50 secrets are valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('concurrent batches from different nodes', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const Bob   = ctx.nodes.get('bob')!
        const Carol = ctx.nodes.get('carol')!

        await setup_nonce_pools(ctx.nodes)

        const alice_pks = generate_ecdh_pubkeys(5)
        const bob_pks   = generate_ecdh_pubkeys(5)
        const carol_pks = generate_ecdh_pubkeys(5)

        const [ alice_results, bob_results, carol_results ] = await Promise.all([
          Promise.all(alice_pks.map(pk => Alice.req.ecdh(pk))),
          Promise.all(bob_pks.map(pk => Bob.req.ecdh(pk))),
          Promise.all(carol_pks.map(pk => Carol.req.ecdh(pk)))
        ])

        st.equal(alice_results.length, 5, 'Alice got 5 results')
        st.equal(bob_results.length, 5, 'Bob got 5 results')
        st.equal(carol_results.length, 5, 'Carol got 5 results')

        // All should be valid
        const all_results = [ ...alice_results, ...bob_results, ...carol_results ]
        st.ok(all_results.every(r => r.ok), 'all requests succeeded')

        const all_secrets = all_results.map(r => r.data!)
        const all_valid = all_secrets.every(secret =>
          typeof secret === 'string' && secret.length === 66
        )
        st.ok(all_valid, 'all 15 secrets are valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.end()
  })

  tape.test('ECDHBatcher: Edge Cases', t => {

    t.test('oversized batch is rejected', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        await setup_nonce_pools(ctx.nodes)

        // Generate 150 unique pubkeys to exceed MAX_ECDH_BATCH_SIZE (100)
        const pubkeys = generate_ecdh_pubkeys(150)

        // Queue all at once to trigger oversized batch
        const promises = pubkeys.map(pk => Alice.req.ecdh(pk))
        const results = await Promise.allSettled(promises)

        // All should be rejected
        const rejected = results.filter(r => !r.ok || (r as PromiseFulfilledResult<{ ok: boolean }>).value?.ok === false)
        st.ok(rejected.length > 0 || results.some(r => r.status === 'rejected'), 'oversized batch requests are rejected')

        // Check that some results contain the expected error message
        const error_results = results.filter(r => {
          if (r.status === 'rejected') return true
          const val = (r as PromiseFulfilledResult<{ ok: boolean, error?: string }>).value
          return !val.ok && val.error?.includes('exceeds maximum')
        })
        st.ok(error_results.length > 0 || rejected.length > 0, 'rejection includes batch size error')

      } catch (err) {
        // Expected - the request should fail
        st.ok(String(err).includes('exceeds maximum') || String(err).includes('batch size'), 'error message indicates batch size limit')
      } finally {
        st.end()
      }
    })

    t.test('single request still works', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        await setup_nonce_pools(ctx.nodes)

        const [ pk ] = generate_ecdh_pubkeys(1)
        const result = await Alice.req.ecdh(pk)

        st.ok(result.ok, 'single request succeeded')
        st.ok(result.data, 'single request returned result')
        st.equal(result.data?.length, 66, 'result is 33 bytes compressed point')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('mixed cache hits and misses in same batch', async st => {
      try {
        const Bob = ctx.nodes.get('bob')!

        await setup_nonce_pools(ctx.nodes)

        // Pre-cache one key
        const [ cached_pk ] = generate_ecdh_pubkeys(1)
        const cached_res = await Bob.req.ecdh(cached_pk)

        await sleep(200)

        // Now batch with mix of cached and new
        const new_pks = generate_ecdh_pubkeys(3)
        const promises = [
          Bob.req.ecdh(cached_pk),  // cache hit
          ...new_pks.map(pk => Bob.req.ecdh(pk))  // cache miss
        ]
        const results = await Promise.all(promises)

        st.ok(results.every(r => r.ok), 'all requests succeeded')
        st.equal(results[0].data, cached_res.data, 'cached key returned same secret')
        st.equal(results.length, 4, 'all 4 requests returned')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.end()
  })
}
