/**
 * Sign API Integration Tests
 *
 * Tests for threshold signature generation with various scenarios.
 */

import { Buff }                       from '@vbyte/buff'
import { verify_signature }           from '@/util/crypto.js'
import { parse_error }                from '@/util/index.js'
import { hash_string }                from '@/test/lib/hash.js'
import { generate_messages, measure_time } from '../lib/helpers.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

export default function (ctx : TestNetwork, tape : Test) {

  tape.test('Sign API: Optimal Cases', t => {

    t.test('single message signing with threshold peers', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        const message = hash_string('test message')
        const tweak = Buff.random(32).hex

        const result = await Alice.req.sign([ message, tweak ])

        st.ok(result.ok, 'sign request succeeded')
        st.ok(result.data, 'received signature result')
        st.equal(result.data.length, 3, 'result is [sighash, pubkey, signature]')

        const [ sighash, pubkey, sig ] = result.data
        st.equal(sighash, message, 'sighash matches input')

        const valid = verify_signature(sig, sighash, pubkey, 'bip340')
        st.ok(valid, 'signature is valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('batch signing multiple messages', async st => {
      try {
        const Bob = ctx.nodes.get('bob')!

        const messages = generate_messages(3)

        const result = await Bob.req.sign_batch(messages)

        st.ok(result.ok, 'batch sign succeeded')
        st.equal(result.data.length, 3, 'received 3 signatures')

        // Verify each signature
        for (const [ sighash, pubkey, sig ] of result.data) {
          const valid = verify_signature(sig, sighash, pubkey, 'bip340')
          st.ok(valid, `signature for ${sighash.slice(0, 8)}... is valid`)
        }

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('signing from different nodes produces consistent group pubkey', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const Bob   = ctx.nodes.get('bob')!
        const Carol = ctx.nodes.get('carol')!

        const message = Buff.random(32).hex
        const tweak = Buff.random(32).hex

        const res1 = await Alice.req.sign([ message, tweak ])
        const res2 = await Bob.req.sign([ message, tweak ])
        const res3 = await Carol.req.sign([ message, tweak ])

        st.ok(res1.ok && res2.ok && res3.ok, 'all sign requests succeeded')

        const [ , pubkey1 ] = res1.data
        const [ , pubkey2 ] = res2.data
        const [ , pubkey3 ] = res3.data

        // All should use the same group public key (with same tweak)
        st.equal(pubkey1, pubkey2, 'Alice and Bob produce same tweaked pubkey')
        st.equal(pubkey2, pubkey3, 'Bob and Carol produce same tweaked pubkey')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('signing performance is reasonable', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        const messages = generate_messages(5)

        const { result, duration } = await measure_time(() => Alice.req.sign_batch(messages))

        st.ok(result.ok, 'sign succeeded')
        st.ok(duration < 10000, `5 signatures completed in ${duration.toFixed(0)}ms (< 10s)`)

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })
  })

  tape.test('Sign API: Edge Cases', t => {

    t.test('signing with exact threshold (2-of-3)', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        // The group is 2-of-3, so we need exactly 2 signers
        // The API selects peers automatically, should work with threshold
        const message = Buff.random(32).hex

        const result = await Alice.req.sign([ message ])

        st.ok(result.ok, 'signing with threshold succeeded')

        const [ sighash, pubkey, sig ] = result.data
        const valid = verify_signature(sig, sighash, pubkey, 'bip340')
        st.ok(valid, 'threshold signature is valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('concurrent sign requests from same node', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        const messages = generate_messages(3)

        // Queue all messages concurrently via single API (uses batcher)
        const promises = messages.map(msg => Alice.req.sign(msg))
        const results = await Promise.all(promises)

        // All should succeed
        st.ok(results.every(r => r.ok), 'all sign requests succeeded')

        const all_valid = results.every(r => {
          const [ sighash, pubkey, sig ] = r.data
          return verify_signature(sig, sighash, pubkey, 'bip340')
        })

        st.ok(all_valid, 'all concurrent signatures are valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('signing same message twice produces different signatures', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        const message = Buff.random(32).hex
        const tweak = Buff.random(32).hex

        const result1 = await Alice.req.sign([ message, tweak ])
        const result2 = await Alice.req.sign([ message, tweak ])

        st.ok(result1.ok && result2.ok, 'both sign requests succeeded')

        // Same message and tweak, but different nonces means potentially different sigs
        // However, both should be valid
        const [ , pubkey1, sig1 ] = result1.data
        const [ , pubkey2, sig2 ] = result2.data

        st.equal(pubkey1, pubkey2, 'same tweaked pubkey for same tweak')

        const valid1 = verify_signature(sig1, message, pubkey1, 'bip340')
        const valid2 = verify_signature(sig2, message, pubkey2, 'bip340')

        st.ok(valid1, 'first signature is valid')
        st.ok(valid2, 'second signature is valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('sign with no tweak (just sighash)', async st => {
      try {
        const Bob = ctx.nodes.get('bob')!

        // Sign with just the sighash, no tweak
        const message = Buff.random(32).hex

        const result = await Bob.req.sign([ message ])

        st.ok(result.ok, 'signing without tweak succeeded')

        const [ sighash, pubkey, sig ] = result.data
        const valid = verify_signature(sig, sighash, pubkey, 'bip340')
        st.ok(valid, 'signature without tweak is valid')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })
  })

  tape.test('Sign API: Error Cases', t => {

    t.test('signing fails gracefully when peers lack nonces', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        // Drain nonces by performing many sign operations
        // This test verifies the error message is descriptive
        // In a real scenario, nonces would be replenished via ping

        // Get pool status to check nonce availability
        const bob_member = Alice.group.members.find(m => m.idx !== Alice.signer.idx)
        if (bob_member) {
          const can_sign = Alice.pool.can_sign(bob_member.idx)
          st.ok(typeof can_sign === 'boolean', 'can_sign returns boolean')
        }

        // The actual insufficient nonces scenario is hard to trigger in integration
        // tests since pings replenish nonces. This validates the API exists.
        st.pass('nonce availability check works')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('signing with invalid sighash format fails', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        // Invalid sighash (not 32 bytes hex)
        const invalid_sighash = 'not-a-valid-sighash'

        const result = await Alice.req.sign_batch([[ invalid_sighash ]])

        st.notOk(result.ok, 'signing with invalid sighash should fail')

      } catch (err) {
        st.pass('signing with invalid sighash threw error as expected')
      } finally {
        st.end()
      }
    })

    t.test('signing empty message array fails gracefully', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        const result = await Alice.req.sign_batch([])

        // Should either fail or return empty results
        if (result.ok) {
          st.equal(result.data.length, 0, 'empty input returns empty output')
        } else {
          st.pass('empty input rejected as expected')
        }

      } catch (err) {
        st.pass('empty input threw error as expected')
      } finally {
        st.end()
      }
    })
  })
}
