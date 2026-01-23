/**
 * Echo API Integration Tests
 *
 * Tests for self-messaging through relays to verify connectivity.
 */

import { Buff }           from '@cmdcode/buff'
import { parse_error }    from '@cmdcode/nostr-p2p/util'
import { measure_time }   from '../lib/helpers.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

export default function (ctx : TestNetwork, tape : Test) {

  tape.test('Echo API: Optimal Cases', t => {

    t.test('basic echo returns challenge unchanged', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const challenge = Buff.random(16).hex

        const res = await Alice.req.echo(challenge)

        st.ok(res.ok, 'echo request succeeded')
        st.equal(res.data, challenge, 'response matches challenge')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('echo with random challenge from each node', async st => {
      try {
        const results : boolean[] = []

        for (const [ name, node ] of ctx.nodes) {
          const challenge = Buff.random(32).hex
          const res = await node.req.echo(challenge)

          if (res.ok && res.data === challenge) {
            results.push(true)
          } else {
            st.comment(`${name} echo failed`)
            results.push(false)
          }
        }

        st.ok(results.every(r => r), 'all nodes echo successfully')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('echo timing is reasonable', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const challenge = Buff.random(16).hex

        const { result, duration } = await measure_time(() => Alice.req.echo(challenge))

        st.ok(result.ok, 'echo succeeded')
        st.ok(duration < 5000, `echo completed in ${duration.toFixed(0)}ms (< 5s)`)

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('concurrent echoes succeed', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!

        const challenges = [
          Buff.random(16).hex,
          Buff.random(16).hex,
          Buff.random(16).hex
        ]

        const results = await Promise.all(
          challenges.map(c => Alice.req.echo(c))
        )

        const all_ok = results.every((r, i) => r.ok && r.data === challenges[i])
        st.ok(all_ok, 'all concurrent echoes succeeded with correct responses')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.end()
  })

  tape.test('Echo API: Edge Cases', t => {

    t.test('echo with empty string challenge', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        const challenge = ''

        const res = await Alice.req.echo(challenge)

        st.ok(res.ok, 'echo with empty string succeeded')
        st.equal(res.data, challenge, 'response matches empty challenge')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('echo with large payload', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        // 1KB challenge
        const challenge = Buff.random(512).hex

        const res = await Alice.req.echo(challenge)

        st.ok(res.ok, 'echo with large payload succeeded')
        st.equal(res.data, challenge, 'large response matches challenge')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('echo with special characters in challenge', async st => {
      try {
        const Alice = ctx.nodes.get('alice')!
        // Use hex encoded data which is safe
        const challenge = Buff.str('test-challenge-with-special-\n\t"chars"').hex

        const res = await Alice.req.echo(challenge)

        st.ok(res.ok, 'echo with special chars succeeded')
        st.equal(res.data, challenge, 'response preserves special chars')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.test('sequential echoes from same node', async st => {
      try {
        const Bob = ctx.nodes.get('bob')!

        for (let i = 0; i < 5; i++) {
          const challenge = Buff.random(16).hex
          const res = await Bob.req.echo(challenge)

          if (!res.ok || res.data !== challenge) {
            st.fail(`echo ${i + 1} failed`)
            st.end()
            return
          }
        }

        st.pass('5 sequential echoes all succeeded')

      } catch (err) {
        st.fail(parse_error(err))
      } finally {
        st.end()
      }
    })

    t.end()
  })
}
