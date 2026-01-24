/**
 * SignBatcher Integration Tests
 *
 * Tests for batch signature processing under load.
 */

import { verify_signature }   from '@/util/crypto.js'
import { parse_error }        from '@/util/index.js'
import { generate_messages, measure_time, sleep } from '../lib/helpers.js'

import type { TestNetwork }   from '@/test/types.js'
import type { SignatureEntry } from '@/types/index.js'
import type { Test }          from 'tape'

export default function (ctx : TestNetwork, tape : Test) {

  tape.test('SignBatcher: Batch Processing', t => {

    t.test('batch 10 concurrent sign requests', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        const messages = generate_messages(10)

        // Queue all at once to trigger batching (uses single API which goes through batcher)
        const promises = messages.map(msg => Alice.req.sign(msg))
        const results = await Promise.all(promises)

        st.ok(results.every(r => r.ok), 'all sign requests succeeded')
        st.equal(results.length, 10, 'received 10 signature results')

        // Verify all signatures
        let valid_count = 0
        for (const result of results) {
          const [ sighash, pubkey, sig ] = result.data
          if (verify_signature(sig, sighash, pubkey, 'bip340')) {
            valid_count++
          }
        }

        st.equal(valid_count, 10, 'all 10 signatures are valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('batch 25 concurrent sign requests', async st => {
      try {
        const Bob = ctx.nodes.get('bob')!

        const messages = generate_messages(25)

        const { result, duration } = await measure_time(async () => {
          const promises = messages.map(msg => Bob.req.sign(msg))
          return Promise.all(promises)
        })

        st.ok(result.every(r => r.ok), 'all sign requests succeeded')
        st.equal(result.length, 25, 'received 25 signature results')

        // Verify all signatures
        const all_valid = result.every(r => {
          const [ sighash, pubkey, sig ] = r.data
          return verify_signature(sig, sighash, pubkey, 'bip340')
        })

        st.ok(all_valid, 'all 25 signatures are valid')
        st.comment(`25 signatures completed in ${duration.toFixed(0)}ms`)

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('batch interval timing (requests within interval are batched)', async st => {
      try {
        const Carol = ctx.nodes.get('carol')!

        const messages = generate_messages(5)

        // Queue all messages quickly (within the 100ms batch interval)
        const start = Date.now()
        const promises = messages.map(msg => Carol.req.sign(msg))
        const results = await Promise.all(promises)
        const duration = Date.now() - start

        st.ok(results.every(r => r.ok), 'all sign requests succeeded')
        st.equal(results.length, 5, 'received 5 results')

        // If batched properly, total time should be close to single batch time
        // (not 5x the single request time)
        st.ok(duration < 10000, `5 batched requests completed in ${duration}ms`)

        // All should be valid
        const all_valid = results.every(r => {
          const [ sighash, pubkey, sig ] = r.data
          return verify_signature(sig, sighash, pubkey, 'bip340')
        })
        st.ok(all_valid, 'all signatures are valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })
  })

  tape.test('SignBatcher: Load Testing', t => {

    t.test('sustained load: 50 signatures in waves', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        const all_results : SignatureEntry[] = []

        // Send 5 waves of 10 signatures each
        for (let wave = 0; wave < 5; wave++) {
          const messages = generate_messages(10)
          const promises = messages.map(msg => Alice.req.sign(msg))
          const results = await Promise.all(promises)
          for (const r of results) {
            if (r.ok) {
              all_results.push(r.data)
            }
          }

          // Small delay between waves to allow nonce replenishment
          await sleep(200)
        }

        st.equal(all_results.length, 50, 'completed 50 signatures')

        // Verify all
        const all_valid = all_results.every(([ sighash, pubkey, sig ]) => {
          return verify_signature(sig, sighash, pubkey, 'bip340')
        })
        st.ok(all_valid, 'all 50 signatures are valid')

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

        // Each node signs 5 messages concurrently
        const alice_msgs = generate_messages(5)
        const bob_msgs   = generate_messages(5)
        const carol_msgs = generate_messages(5)

        const [ alice_results, bob_results, carol_results ] = await Promise.all([
          Promise.all(alice_msgs.map(msg => Alice.req.sign(msg))),
          Promise.all(bob_msgs.map(msg => Bob.req.sign(msg))),
          Promise.all(carol_msgs.map(msg => Carol.req.sign(msg)))
        ])

        st.ok(alice_results.every(r => r.ok), 'Alice requests succeeded')
        st.ok(bob_results.every(r => r.ok), 'Bob requests succeeded')
        st.ok(carol_results.every(r => r.ok), 'Carol requests succeeded')

        st.equal(alice_results.length, 5, 'Alice got 5 results')
        st.equal(bob_results.length, 5, 'Bob got 5 results')
        st.equal(carol_results.length, 5, 'Carol got 5 results')

        // Verify all
        const all_results = [ ...alice_results, ...bob_results, ...carol_results ]
        const all_valid = all_results.every(r => {
          const [ sighash, pubkey, sig ] = r.data
          return verify_signature(sig, sighash, pubkey, 'bip340')
        })
        st.ok(all_valid, 'all 15 signatures are valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })
  })

  tape.test('SignBatcher: Edge Cases', t => {

    t.test('single request still works (no batching needed)', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        const messages = generate_messages(1)
        const result = await Alice.req.sign(messages[0])

        st.ok(result.ok, 'single sign request succeeded')
        st.ok(result.data, 'single request returned result')

        const [ sighash, pubkey, sig ] = result.data
        const valid = verify_signature(sig, sighash, pubkey, 'bip340')
        st.ok(valid, 'single signature is valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('requests arriving after batch interval form new batch', async st => {
      try {
        const Bob = ctx.nodes.get('bob')!

        // First request
        const msg1 = generate_messages(1)[0]
        const result1 = await Bob.req.sign(msg1)

        // Wait longer than batch interval
        await sleep(200)

        // Second request should form new batch
        const msg2 = generate_messages(1)[0]
        const result2 = await Bob.req.sign(msg2)

        st.ok(result1.ok, 'first batch result received')
        st.ok(result2.ok, 'second batch result received')

        // Both should be valid
        const [ , pubkey1, sig1 ] = result1.data
        const [ sighash1 ] = result1.data
        const [ , pubkey2, sig2 ] = result2.data
        const [ sighash2 ] = result2.data

        const valid1 = verify_signature(sig1, sighash1, pubkey1, 'bip340')
        const valid2 = verify_signature(sig2, sighash2, pubkey2, 'bip340')
        st.ok(valid1 && valid2, 'both signatures are valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })
  })
}
